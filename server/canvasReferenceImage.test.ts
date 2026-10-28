import * as capabilities from '../src/lib/canvasImageCapabilities';
import * as imageInputs from '../src/components/canvas/imageInputs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { assetService } from '../src/services/assetService';
import { assertReferenceImageSupported, readReferenceImage, referenceImageUrl, saveReferenceImage } from '../src/components/canvas/referenceImage';
import type { ProviderProtocol } from '../src/types/provider';

const file = (type = 'image/png', size = 16) => ({ name: '参考.png', type, size }) as File;

test('节点引用只保留稳定资产 ID 和文件名，恢复后可重新构造预览 URL', () => {
  assert.equal(readReferenceImage(undefined), undefined);
  assert.equal(readReferenceImage({ assetId: '', name: 'x' }), undefined);
  const restored = readReferenceImage(JSON.parse(JSON.stringify({ assetId: 'asset-1', name: '参考.png', blobUrl: 'blob:temporary' })));
  assert.deepEqual(restored, { assetId: 'asset-1', name: '参考.png' });
  assert.equal(referenceImageUrl(restored!), '/api/assets/asset-1/preview?size=512');
});

test('非法、空及超限文件在读取或网络请求前拒绝', async () => {
  await assert.rejects(saveReferenceImage(file('video/mp4')), /仅支持/);
  await assert.rejects(saveReferenceImage(file('image/svg+xml')), /仅支持/);
  await assert.rejects(saveReferenceImage(file('image/png', 0)), /非空/);
  await assert.rejects(saveReferenceImage(file('image/png', 10 * 1024 * 1024 + 1)), /10 MB/);
});

test('上传调用真实资产入库服务，节点不保存 base64；失败向调用者传播', async () => {
  const originalCreate = assetService.create;
  const originalReader = globalThis.FileReader;
  const calls: unknown[] = [];
  class Reader {
    result = 'data:image/png;base64,dGVzdA==';
    onload?: () => void;
    readAsDataURL() { this.onload?.(); }
  }
  globalThis.FileReader = Reader as unknown as typeof FileReader;
  assetService.create = async (input) => {
    calls.push(input);
    return { id: 'saved-asset' } as Awaited<ReturnType<typeof assetService.create>>;
  };
  try {
    assert.deepEqual(await saveReferenceImage(file()), { assetId: 'saved-asset', name: '参考.png' });
    assert.deepEqual(calls[0], {
      type: 'image', title: '参考.png', sourceUrl: 'data:image/png;base64,dGVzdA==',
      userMetadata: { source: 'local-upload', purpose: 'canvas-reference' },
    });
    assetService.create = async () => { throw new Error('磁盘不可写'); };
    await assert.rejects(saveReferenceImage(file()), /磁盘不可写/);
  } finally {
    assetService.create = originalCreate;
    globalThis.FileReader = originalReader;
  }
});

for (const protocol of ['responses', 'chat-completions', 'anthropic-messages'] as ProviderProtocol[]) {
  for (const kind of ['imageGen', 'video'] as const) {
    test(`${protocol} / ${kind} 不伪称参考图已支持`, () => {
      assert.throws(() => assertReferenceImageSupported(kind, { protocol }), /尚不支持.*不会忽略参考图/);
    });
  }
}

// Exercise the real shared generation entry without importing the browser's canvas/icon stack.
for (const kind of ['imageGen', 'video'] as const) {
  test(`${kind} 参考图在任何供应商调用、资产保存及生成状态变更前被拦截`, async () => {
    const data: Record<string, unknown> = { prompt: '参考生成', referenceImage: { assetId: 'saved-asset', name: '参考.png' } };
    const node = { id: 'n', type: kind, data };
    const provider = { id: 'p', name: 'provider', protocol: 'responses', models: [{ id: 'm' }] };
    let paidCalls = 0;
    const updates: Array<Record<string, unknown>> = [];
    const source = readFileSync(new URL('../src/components/canvas/generation.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const running = new Set();
    const dependencies: Record<string, unknown> = {
      '../../lib/canvasImageCapabilities': capabilities, './imageInputs': imageInputs,
      '../../services/assetService': { assetService: { create: () => { throw new Error('unexpected save'); } } },
      '../../services/providerService': Object.fromEntries(['generateProviderImage', 'generateProviderVideo', 'generateProviderText'].map((name) => [name, () => { paidCalls += 1; }])),
      '../../stores/useCanvasStore': { runningGenerations: running, useCanvasStore: { getState: () => ({ nodes: [node], edges: [], updateNode: (_id: string, patch: Record<string, unknown>) => updates.push(patch) }) } },
      '../../stores/useProviderStore': {
        getConfiguredModels: () => [{ id: 'm' }], getSelectedModel: () => 'm', providerSupportsCategory: () => true,
        useProviderStore: { getState: () => ({ providers: [provider], activeProviderIds: { image: 'p', video: 'p' } }) },
      },
      './canvasModel': { isCanvasNodeKind: () => true, composePrompt: (prompt: string) => prompt },
      './referenceImage': { assertReferenceImageSupported, readReferenceImage },
      '../../lib/musicModels': { assertMusicModelSupported: () => { throw new Error('unexpected music'); }, clampMusicSeconds: () => 30 },
    };
    const exports: { runNodeGeneration?: (id: string) => Promise<string> } = {};
    runInNewContext(compiled, { exports, Error, require: (name: string) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    } });
    assert.equal(await exports.runNodeGeneration!('n'), 'failed');
    assert.equal(paidCalls, 0);
    assert.equal(running.size, 0);
    assert.match(String(updates[0].error), /尚不支持/);
    assert.equal(updates.some((patch) => patch.isGenerating), false);
  });
}

for (const protocol of ['responses', 'chat-completions'] as const) {
  test(`${protocol} documented edits models pass, unsupported models fail closed`, () => {
    for (const model of ['gpt-image-1-mini', 'gpt-image-1.5', 'gpt-image-2', 'gpt-image-2-2026-04-21', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-sunburst-2026-09-08', 'gpt-image-2.5-flare', 'gpt-image-2.5-flare-2026-09-08', 'chatgpt-image-latest']) {
      assert.doesNotThrow(() => assertReferenceImageSupported('imageGen', { protocol }, model));
    }
    for (const model of ['gpt-image-1', 'dall-e-3', 'nanobanana', 'vendor-alias']) {
      assert.throws(() => assertReferenceImageSupported('imageGen', { protocol }, model), /不会忽略参考图/);
    }
  });
}

for (const fail of [false, true]) {
  test(`canvas sends asset ID to image service and ${fail ? 'surfaces upstream failure without retry' : 'keeps successful edit output'}`, async () => {
    const data = { prompt: 'edit reference', referenceImage: { assetId: 'saved-asset', name: 'ref.png' } };
    const node = { id: 'n', type: 'imageGen', data };
    const provider = { id: 'p', protocol: 'responses' };
    const calls: unknown[][] = [];
    const updates: Array<Record<string, unknown>> = [];
    const source = readFileSync(new URL('../src/components/canvas/generation.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const dependencies: Record<string, unknown> = {
      '../../lib/canvasImageCapabilities': capabilities, './imageInputs': imageInputs,
      '../../services/assetService': { assetService: { create: async () => { throw new Error('saving intentionally mocked'); } } },
      '../../services/providerService': { generateProviderImage: async (...args: unknown[]) => {
        calls.push(args);
        if (fail) throw new Error('upstream rejected edit');
        return { url: 'https://example.invalid/edited.png' };
      } },
      '../../stores/useCanvasStore': { runningGenerations: new Set(), useCanvasStore: { getState: () => ({ nodes: [node], edges: [], updateNode: (_id: string, patch: Record<string, unknown>) => updates.push(patch) }) } },
      '../../stores/useProviderStore': {
        getConfiguredModels: () => [{ id: 'gpt-image-2' }], getSelectedModel: () => 'gpt-image-2', providerSupportsCategory: () => true,
        useProviderStore: { getState: () => ({ providers: [provider], activeProviderIds: { image: 'p' } }) },
      },
      './canvasModel': {
        isCanvasNodeKind: () => true, composePrompt: (prompt: string) => prompt, clampCount: () => 1,
        imageSizeForRatio: () => '1024x1024', readResults: () => [], mergeResults: (_old: unknown, fresh: unknown) => fresh,
      },
      './referenceImage': { assertReferenceImageSupported, readReferenceImage },
      '../../lib/musicModels': { assertMusicModelSupported: () => { throw new Error('unexpected music'); }, clampMusicSeconds: () => 30 },
    };
    const exports: { runNodeGeneration?: (id: string) => Promise<string> } = {};
    runInNewContext(compiled, { exports, Error, AbortController, crypto: globalThis.crypto, require: (name: string) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    } });
    assert.equal(await exports.runNodeGeneration!('n'), fail ? 'failed' : 'done');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], provider);
    assert.equal(JSON.stringify(calls[0][1]), JSON.stringify({ prompt: 'edit reference', size: '1024x1024', quality: 'medium', canvasParameters: { aspectRatio: '1:1', quality: 'medium' }, referenceImage: { assetId: 'saved-asset' } }));
    assert.equal(calls[0][2], 'gpt-image-2');
    if (fail) assert.ok(updates.some((patch) => patch.error === 'upstream rejected edit'));
    else assert.ok(updates.some((patch) => patch.imageUrl === 'https://example.invalid/edited.png'));
  });
}
