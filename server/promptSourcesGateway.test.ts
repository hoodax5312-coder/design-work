import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApiApp } from './createApiApp';

test('prompt source CRUD, sync and cached case reads are durable', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'design-work-prompt-sources-'));
  const dataDirectory = path.join(root, 'data');
  const cacheDirectory = path.join(root, 'cache');
  await fs.mkdir(path.join(root, '.design-work'), { recursive: true });
  await fs.writeFile(path.join(root, '.design-work', 'settings.json'), JSON.stringify({ dataDirectory, cacheDirectory }));
  let healthy = true;
  const upstream = (await import('node:http')).createServer((request, response) => {
    if (!healthy) { response.statusCode = 503; response.end('offline'); return; }
    response.setHeader('content-type', 'application/json');
    response.end(request.url === '/prompts.json'
      ? JSON.stringify({ prompts: [{ id: 'one', sourceId: 'banana', title: '杯子', prompt: '白色陶瓷杯', tags: ['产品'] }] })
      : JSON.stringify({ promptsPath: '/prompts.json', sources: [{ id: 'banana', name: 'Banana Prompt', homepage: 'https://banana.example.com' }] }));
  });
  const app = createApiApp(root);
  const api = app.listen(0, '127.0.0.1');
  upstream.listen(0, '127.0.0.1');
  try {
    await Promise.all([new Promise<void>((resolve) => api.once('listening', resolve)), new Promise<void>((resolve) => upstream.once('listening', resolve))]);
    const origin = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
    const upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/manifest.json`;
    const invalid = await fetch(`${origin}/api/prompt-sources`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'bad', manifestUrl: 'http://example.com/manifest.json' }) });
    assert.equal(invalid.status, 500);
    const created = await (await fetch(`${origin}/api/prompt-sources`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '测试来源', manifestUrl: upstreamUrl }) })).json() as { id: string };
    const synced = await fetch(`${origin}/api/prompt-sources/${created.id}/sync`, { method: 'POST' });
    assert.equal(synced.status, 200);
    const catalog = await (await fetch(`${origin}/api/prompt-sources/catalog`)).json() as { items: Array<{ id: string; name: string; itemCount: number; enabled: boolean }> };
    assert.equal(catalog.items.length, 1);
    assert.equal(catalog.items[0].name, 'Banana Prompt');
    assert.equal(catalog.items[0].itemCount, 1);
    const catalogId = catalog.items[0].id;
    const editedCatalog = await (await fetch(`${origin}/api/prompt-sources/catalog/${catalogId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '已编辑网站', enabled: false }) })).json() as { name: string; enabled: boolean };
    assert.equal(editedCatalog.name, '已编辑网站');
    assert.equal(editedCatalog.enabled, false);
    const hiddenCases = await (await fetch(`${origin}/api/cases`)).json() as { total: number };
    assert.equal(hiddenCases.total, 0);
    const reenabled = await (await fetch(`${origin}/api/prompt-sources/catalog/${catalogId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) })).json() as { enabled: boolean };
    assert.equal(reenabled.enabled, true);
    const reordered = await fetch(`${origin}/api/prompt-sources/catalog/order`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: [catalogId] }) });
    assert.equal(reordered.status, 200);
    const cases = await (await fetch(`${origin}/api/cases?query=陶瓷`)).json() as { total: number };
    assert.equal(cases.total, 1);
    const edited = await (await fetch(`${origin}/api/prompt-sources/${created.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '已编辑来源', manifestUrl: upstreamUrl }) })).json() as { name: string };
    assert.equal(edited.name, '已编辑来源');
    healthy = false;
    const failed = await fetch(`${origin}/api/prompt-sources/${created.id}/sync`, { method: 'POST' });
    assert.equal(failed.status, 500);
    const retained = await (await fetch(`${origin}/api/cases`)).json() as { total: number };
    assert.equal(retained.total, 1);
    const deleted = await fetch(`${origin}/api/prompt-sources/catalog/${catalogId}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);
    const afterDelete = await (await fetch(`${origin}/api/prompt-sources/catalog`)).json() as { items: unknown[] };
    assert.equal(afterDelete.items.length, 0);
    const syncedAgain = await fetch(`${origin}/api/prompt-sources/${created.id}/sync`, { method: 'POST' });
    assert.equal(syncedAgain.status, 500);
    const afterResync = await (await fetch(`${origin}/api/prompt-sources/catalog`)).json() as { items: unknown[] };
    assert.equal(afterResync.items.length, 0);
  } finally {
    await Promise.all([new Promise<void>((resolve, reject) => api.close((error) => error ? reject(error) : resolve())), new Promise<void>((resolve) => upstream.close(() => resolve()))]);
    await fs.rm(root, { recursive: true, force: true });
  }
});
