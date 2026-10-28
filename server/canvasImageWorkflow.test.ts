import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Node } from '@xyflow/react';
import ts from 'typescript';
import * as model from '../src/components/canvas/canvasModel';
import * as inputs from '../src/components/canvas/imageInputs';
import * as reference from '../src/components/canvas/referenceImage';
import * as capabilities from '../src/lib/canvasImageCapabilities';

const image = (id: string, data: Record<string, unknown> = {}): Node => ({ id, type: 'imageGen', position: { x: 0, y: 0 }, width: 320, data });
const source = () => image('source', { title: '原图', imageUrl: '/old', assetId: 'old-import', activeResultId: 'b', results: [
  { id: 'a', url: '/a', assetId: 'asset-a', prompt: '', createdAt: 1 },
  { id: 'b', url: '/b', assetId: 'asset-b', prompt: '', createdAt: 2 },
] });
const edge = { id: 'e', source: 'source', target: 'target' };

test('image inputs follow active result, persist provenance and never reuse a stale imported asset', () => {
  const n = source();
  assert.deepEqual(inputs.imageInputFromNode(n), { assetId: 'asset-b', name: '原图', sourceNodeId: 'source', sourceResultId: 'b' });
  n.data.activeResultId = 'a';
  assert.equal(inputs.imageInputFromNode(n).assetId, 'asset-a');
  n.data.results = [{ id: 'a', url: '/a', prompt: '', createdAt: 1 }];
  assert.throws(() => inputs.imageInputFromNode(n), /尚未存入资产库/);
  assert.throws(() => inputs.imageInputFromNode(image('n', { uploading: true, assetId: 'a' })), /等待完成/);
  assert.equal(inputs.imageInputFromNode(image('n', { assetId: 'imported' })).assetId, 'imported');
});

test('manual and linked inputs cannot silently replace each other; duplicate edges do not duplicate inputs', () => {
  const nodes = [source(), image('target')];
  assert.equal(inputs.resolveImageInput('target', {}, nodes, [edge, { ...edge, id: 'duplicate' }], 1)?.assetId, 'asset-b');
  assert.throws(() => inputs.resolveImageInput('target', { referenceImage: { assetId: 'm', name: 'manual' } }, nodes, [edge], 1), /最多支持 1/);
  assert.throws(() => inputs.resolveImageInput('target', {}, [...nodes, image('other', { assetId: 'o' })], [edge, { id: 'o', source: 'other', target: 'target' }], 1), /不会自动丢弃/);
  assert.throws(() => inputs.resolveImageInput('target', {}, nodes, [edge], 0), /不会忽略参考图/);
  assert.equal(inputs.resolveImageInput('target', {}, nodes, [], 1), undefined);
});

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key),
} });
const { useCanvasStore } = await import('../src/stores/useCanvasStore');

test('continue edit adds one blank downstream and edge, keeps source intact, supports undo/redo and JSON restore', () => {
  const n = source();
  n.data.prompt = 'do not copy source prompt'; n.data.count = 4;
  const original = JSON.stringify(n);
  useCanvasStore.setState({ projectId: null, nodes: [n], edges: [], undoStack: [], redoStack: [], selectedNodes: [] });
  const derived = inputs.derivedImageNode(n, [n]);
  assert.equal(derived.node.data.prompt, ''); assert.equal(derived.node.data.count, 1);
  for (const key of ['results', 'imageUrl', 'assetId', 'isGenerating', 'referenceImage']) assert.equal(derived.node.data[key], undefined);
  assert.equal(JSON.stringify(n), original);
  useCanvasStore.getState().addNodes([derived.node], [derived.edge]);
  assert.equal(useCanvasStore.getState().nodes.length, 2); assert.equal(useCanvasStore.getState().edges.length, 1);
  useCanvasStore.getState().undo(); assert.equal(useCanvasStore.getState().nodes.length, 1);
  useCanvasStore.getState().redo(); assert.equal(useCanvasStore.getState().nodes.length, 2);
  const restored = JSON.parse(JSON.stringify(useCanvasStore.getState().getSnapshot()));
  assert.equal(inputs.resolveImageInput(derived.node.id, {}, restored.nodes, restored.edges, 1)?.assetId, 'asset-b');
  useCanvasStore.getState().removeEdges([derived.edge.id]);
  assert.equal(useCanvasStore.getState().nodes.length, 2); assert.equal(useCanvasStore.getState().edges.length, 0);
});

const generation = (nodes: Node[], edges = [edge], options: { unsupported?: boolean; fail?: boolean; deferSave?: boolean } = {}) => {
  const calls: Array<Record<string, unknown>> = [];
  let finishSave: (() => void) | undefined;
  const saving = options.deferSave ? new Promise<void>((resolve) => { finishSave = resolve; }) : Promise.resolve();
  const dependencies: Record<string, unknown> = {
    '../../services/assetService': { assetService: { create: async () => { await saving; return { id: 'saved-output' }; } } },
    '../../services/providerService': { generateProviderImage: async (_provider: unknown, input: Record<string, unknown>) => {
      calls.push(input); if (options.fail) throw new Error('upstream edit failed'); return { url: '/result' };
    } },
    '../../stores/useCanvasStore': { runningGenerations: new Set(), useCanvasStore: { getState: () => ({ nodes, edges, updateNode: (id: string, patch: object) => Object.assign(nodes.find((n) => n.id === id)!.data, patch) }) } },
    '../../stores/useProviderStore': {
      getConfiguredModels: () => [{ id: options.unsupported ? 'alias' : 'gpt-image-2' }], getSelectedModel: () => options.unsupported ? 'alias' : 'gpt-image-2', providerSupportsCategory: () => true,
      useProviderStore: { getState: () => ({ providers: [{ id: 'p', protocol: 'responses' }], activeProviderIds: { image: 'p' } }) },
    },
    './canvasModel': model, './imageInputs': inputs, './referenceImage': reference, '../../lib/canvasImageCapabilities': capabilities, '../../lib/musicModels': {},
  };
  const exports: { runNodeGeneration?: (id: string) => Promise<string>; runNodesInOrder?: (ids: string[]) => Promise<{ done: number; failed: number; skipped: number }> } = {};
  const compiled = ts.transpileModule(readFileSync(new URL('../src/components/canvas/generation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(compiled, { exports, Error, AbortController, crypto: globalThis.crypto, require: (name: string) => { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return { run: exports.runNodeGeneration!, runChain: exports.runNodesInOrder!, calls, finishSave };
};

test('chain treats an imported image as ready input rather than regenerating or blocking it', async () => {
  const nodes = [source(), image('target', { prompt: '修改要求' })];
  const original = JSON.stringify(nodes[0]);
  const api = generation(nodes);
  const summary = await api.runChain(['source', 'target']);
  assert.equal(summary.done, 1); assert.equal(summary.skipped, 1); assert.equal(summary.failed, 0);
  assert.equal(api.calls.length, 1); assert.equal(JSON.stringify(nodes[0]), original);
});

test('linked image submits selected original ID with immutable source/result snapshot and waits for saving', async () => {
  const nodes = [source(), image('target', { prompt: '改成夜景' })];
  const api = generation(nodes, [edge], { deferSave: true });
  let done = false;
  const pending = api.run('target').then((result) => { done = true; return result; });
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(done, false);
  api.finishSave!(); assert.equal(await pending, 'done');
  assert.equal(api.calls.length, 1);
  assert.equal(JSON.stringify(api.calls[0].referenceImage), JSON.stringify({ assetId: 'asset-b' }));
  const snapshot = model.readResults(nodes[1].data)[0].generationSnapshot!;
  nodes[0].data.activeResultId = 'a';
  assert.equal(snapshot.referenceImage?.assetId, 'asset-b'); assert.equal(snapshot.referenceImage?.sourceResultId, 'b');
  assert.equal(model.readResults(nodes[1].data)[0].assetId, 'saved-output');
});

for (const failure of ['unsupported', 'missing', 'multiple', 'conflict', 'parameters', 'upstream'] as const) {
  test(`${failure}: no dropped reference, fallback or automatic retry`, async () => {
    const nodes = [source(), image('target', { prompt: '修改要求' })];
    const edges = [edge];
    if (failure === 'missing') nodes[0].data.results = [];
    if (failure === 'missing') nodes[0].data.assetId = undefined;
    if (failure === 'multiple') { nodes.push(image('other', { assetId: 'o' })); edges.push({ id: 'e2', source: 'other', target: 'target' }); }
    if (failure === 'conflict') nodes[1].data.referenceImage = { assetId: 'manual', name: 'manual' };
    if (failure === 'parameters') nodes[1].data.aspectRatio = '21:9';
    const api = generation(nodes, edges, { unsupported: failure === 'unsupported', fail: failure === 'upstream' });
    assert.equal(await api.run('target'), 'failed');
    assert.equal(api.calls.length, failure === 'upstream' ? 1 : 0);
    assert.ok(nodes[1].data.error);
  });
}
