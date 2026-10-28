import * as capabilities from '../src/lib/canvasImageCapabilities';
import * as imageInputs from '../src/components/canvas/imageInputs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as model from '../src/components/canvas/canvasModel';
import * as reference from '../src/components/canvas/referenceImage';

const compile = (file: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}) => {
  const exports: Record<string, (...args: any[]) => any> = {};
  const source = readFileSync(new URL(`../src/components/canvas/${file}.ts`, import.meta.url), 'utf8');
  dependencies['../../lib/canvasImageCapabilities'] = capabilities;
  dependencies['./imageInputs'] = imageInputs;
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(compiled, { exports, Error, AbortController, crypto: globalThis.crypto, ...globals, require: (name: string) => {
    assert.ok(name in dependencies, name);
    return dependencies[name];
  } });
  return exports;
};

const node = (data: Record<string, unknown> = {}) => ({ id: 'n', type: 'imageGen', position: { x: 0, y: 0 }, data });

test('image import persists asset ID; failure is visible; deleting pending node does not recreate it', async () => {
  let nodes = [node({ uploading: true })];
  let fail = false;
  let finish: (() => void) | undefined;
  const calls: unknown[] = [];
  const api = compile('imageAsset', {
    '../../services/assetService': { assetService: { create: async (input: unknown) => {
      calls.push(input);
      if (fail) throw new Error('磁盘不可写');
      if (finish) await new Promise<void>((resolve) => { finish = resolve; });
      return { id: 'saved' };
    } } },
    '../../stores/useCanvasStore': { useCanvasStore: { getState: () => ({ nodes, updateNode: (id: string, patch: object) => { nodes = nodes.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n); } }) } },
    './canvasModel': model,
  }, { FileReader: class { result = 'data:image/png;base64,dGVzdA=='; onload?: () => void; readAsDataURL() { this.onload?.(); } } });
  const file = { type: 'image/png', size: 16, name: 'test.png' };
  assert.equal(await api.uploadImageToNode('n', file), true);
  assert.equal(nodes[0].data.imageUrl, '/api/assets/saved/original');
  assert.equal(nodes[0].data.assetId, 'saved');
  assert.equal(nodes[0].data.uploading, false);
  const restored = model.normalizeRestoredCanvas({ nodes: JSON.parse(JSON.stringify(nodes)), edges: [] }, () => false, () => false);
  assert.equal(restored.nodes[0].data.imageUrl, '/api/assets/saved/original');
  const interrupted = model.normalizeRestoredCanvas({ nodes: [node({ uploading: true })], edges: [] }, () => false);
  assert.equal(interrupted.nodes[0].data.uploading, false);
  assert.match(String(interrupted.nodes[0].data.error), /已中断/);
  fail = true;
  assert.equal(await api.uploadImageToNode('n', file), false);
  assert.equal(nodes[0].data.error, '磁盘不可写');
  fail = false;
  finish = () => {};
  const pending = api.uploadImageToNode('n', file);
  await Promise.resolve(); await Promise.resolve();
  nodes = [];
  finish();
  assert.equal(await pending, true);
  assert.deepEqual(nodes, []);
  const before = calls.length;
  await assert.rejects(api.saveCanvasImage({ ...file, size: 51 * 1024 * 1024 }), /50 MB/);
  await assert.rejects(api.saveCanvasImage({ ...file, size: 0 }), /非空/);
  assert.equal(calls.length, before);
});

test('real image dimensions are per result and stale load cannot overwrite current image', () => {
  const n = node({ imageUrl: 'portrait', activeResultId: 'p', results: [
    { id: 'l', url: 'landscape', prompt: '', createdAt: 1, width: 1600, height: 900 },
    { id: 'p', url: 'portrait', prompt: '', createdAt: 2 },
  ] });
  const api = compile('imageAsset', {
    '../../services/assetService': {}, './canvasModel': model,
    '../../stores/useCanvasStore': { useCanvasStore: { getState: () => ({ nodes: [n], updateNode: (_id: string, patch: object) => Object.assign(n.data, patch) }) } },
  });
  api.recordImageDimensions('n', 'landscape', 200, 100);
  assert.equal(model.readResults(n.data)[1].width, undefined);
  api.recordImageDimensions('n', 'portrait', 600, 1200);
  assert.equal(model.readResults(n.data)[1].width, 600);
  assert.equal(api.imageAspectRatio(600, 1200, '1 / 1'), '600 / 1200');
  assert.equal(api.imageAspectRatio(Infinity, 0, '1 / 1'), '1 / 1');
  assert.equal(model.readResults(n.data)[0].width, 1600);
});

for (const failure of [false, true]) test(`generation snapshot stays immutable; partial success / failures never auto retry (${failure})`, async () => {
  const n = node({ prompt: 'original', aspectRatio: '9:16', quality: 'hd', count: 2, referenceImage: { assetId: 'ref', name: 'ref.png' } });
  let paidCalls = 0;
  const provider = { id: 'p', protocol: 'responses', apiKey: 'SECRET_NEVER_SAVE' };
  const saved: Record<string, unknown>[] = [];
  const api = compile('generation', {
    '../../services/assetService': { assetService: { create: async (input: Record<string, unknown>) => { saved.push(input); return { id: 'asset' }; } } },
    '../../services/providerService': { generateProviderImage: async () => {
      paidCalls++;
      n.data.prompt = 'edited while running';
      (n.data.referenceImage as { name: string }).name = 'changed';
      if (failure || paidCalls === 2) throw new Error('upstream failed');
      return { url: 'https://example.invalid/image.png' };
    } },
    '../../stores/useCanvasStore': { runningGenerations: new Set(), useCanvasStore: { getState: () => ({ nodes: [n], edges: [], updateNode: (_id: string, patch: object) => Object.assign(n.data, patch) }) } },
    '../../stores/useProviderStore': {
      getConfiguredModels: () => [{ id: 'gpt-image-2' }], getSelectedModel: () => 'gpt-image-2', providerSupportsCategory: () => true,
      useProviderStore: { getState: () => ({ providers: [provider], activeProviderIds: { image: 'p' } }) },
    },
    './canvasModel': model, './referenceImage': reference, '../../lib/musicModels': {},
  });
  assert.equal(await api.runNodeGeneration('n'), failure ? 'failed' : 'done');
  await Promise.resolve(); await Promise.resolve();
  assert.equal(paidCalls, 2);
  if (failure) { assert.equal(model.readResults(n.data).length, 0); return; }
  const result = model.readResults(n.data)[0];
  assert.equal(result.generationSnapshot?.prompt, 'original');
  assert.equal(result.generationSnapshot?.referenceImage?.name, 'ref.png');
  assert.equal(result.generationSnapshot?.size, '1024x1536');
  assert.equal(result.generationSnapshot?.count, 2);
  assert.equal(result.url, '/api/assets/asset/original');
  assert.equal(JSON.stringify(saved).includes('SECRET'), false);
  assert.match(String(n.data.notice), /失败/);
  n.data.uploading = true;
  assert.equal(api.isNodeRunnable(n, [n], []), false);
  assert.equal(await api.runNodeGeneration('n'), 'skipped');
  assert.equal(paidCalls, 2);
});

test('download uses original asset and MIME extension, never saves preview as original', async () => {
  let fetched = ''; let filename = ''; let clicked = 0;
  let ok = true;
  const api = compile('imageAsset', { '../../services/assetService': {}, '../../stores/useCanvasStore': {}, './canvasModel': model }, {
    fetch: async (url: string) => { fetched = url; return { ok, status: 404, blob: async () => ({ type: 'image/jpeg', size: 10 }) }; },
    URL: { createObjectURL: () => 'blob:download', revokeObjectURL: () => {} },
    document: { createElement: () => ({ set download(value: string) { filename = value; }, click() { clicked++; } }) },
    window: { setTimeout: (fn: () => void) => fn() },
  });
  await api.downloadOriginalImage('asset', '/api/assets/asset/preview', '风景.png');
  assert.equal(fetched, '/api/assets/asset/original?download=1');
  assert.equal(filename, '风景.jpg'); assert.equal(clicked, 1);
  ok = false;
  await assert.rejects(api.downloadOriginalImage('asset', 'preview', 'test'), /404/);
  await assert.rejects(api.downloadOriginalImage(undefined, '/api/assets/old/preview', 'test'), /没有原图引用/);
  assert.equal(clicked, 1);
});
