import assert from 'node:assert/strict';
import test from 'node:test';
import { workspaceCacheService } from '../src/services/workspaceCacheService';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
} });

test('网关失败仍可从同步恢复副本读取多页内容，重试成功后移除副本', async () => {
  const value = { version: 2, projects: { one: { boards: ['一', '二'] } } };
  globalThis.fetch = async () => { throw new Error('offline'); };
  const pending = workspaceCacheService.write('canvas-workspace', value);
  assert.deepEqual(await workspaceCacheService.read('canvas-workspace'), value);
  await assert.rejects(pending, /无法连接本机网关/);
  assert.deepEqual(await workspaceCacheService.read('canvas-workspace'), value);
  globalThis.fetch = async () => new Response('{"ok":true}', { status: 200 });
  await workspaceCacheService.write('canvas-workspace', value);
  assert.equal(storage.size, 0);
});

test('连续写入串行执行，旧写入成功不会删除新的恢复副本', async () => {
  const releases: Array<() => void> = [];
  const bodies: string[] = [];
  globalThis.fetch = async (_url, init) => {
    bodies.push(String(init?.body));
    await new Promise<void>((resolve) => releases.push(resolve));
    return new Response('{"ok":true}');
  };
  const first = workspaceCacheService.write('canvas-workspace', { revision: 1 });
  const second = workspaceCacheService.write('canvas-workspace', { revision: 2 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(bodies.length, 1);
  releases[0]();
  await first;
  assert.deepEqual(await workspaceCacheService.read('canvas-workspace'), { revision: 2 });
  await new Promise((resolve) => setImmediate(resolve));
  releases[1]();
  await second;
  assert.deepEqual(bodies, ['{"revision":1}', '{"revision":2}']);
  assert.equal(storage.size, 0);
});
