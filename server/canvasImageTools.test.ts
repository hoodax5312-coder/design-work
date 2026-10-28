import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Node } from '@xyflow/react';
import ts from 'typescript';
import type * as Tools from '../src/components/canvas/imageTools';
import { nodeRect } from '../src/components/canvas/canvasModel';

const compiled = ts.transpileModule(readFileSync(new URL('../src/components/canvas/imageTools.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const setup = (options: { failAt?: number; deleteAt?: number; switchAt?: number; missingId?: boolean; readFail?: boolean; pixels?: number[]; decodeFail?: boolean; emptyBlob?: boolean } = {}) => {
  const source: Node = { id: 'source', type: 'imageGen', position: { x: 0, y: 0 }, width: 320, height: 240, data: { assetId: 'original' } };
  const state = { projectId: 'project', nodes: [source], addNodes: (...args: unknown[]) => { additions.push(args); } };
  const additions: unknown[][] = [];
  const creates: Record<string, unknown>[] = [];
  const draws: unknown[][] = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args: unknown[]) => draws.push(args) }),
    toBlob: (callback: (blob: Blob | null) => void) => callback(options.emptyBlob ? null : new Blob(['png'], { type: 'image/png' })) };
  class Reader {
    result = 'data:image/png;base64,cG5n';
    onload = () => {}; onerror = () => {}; onabort = () => {};
    readAsDataURL() { if (options.readFail) this.onerror(); else this.onload(); }
  }
  class ImageMock {
    src = '';
    naturalWidth = options.pixels?.[0] ?? 100;
    naturalHeight = options.pixels?.[1] ?? 80;
    async decode() { if (options.decodeFail) throw new Error('decode'); }
  }
  const exports = {} as typeof Tools;
  const dependencies: Record<string, unknown> = {
    '../../services/assetService': { assetService: { create: async (input: Record<string, unknown>) => {
      creates.push(input);
      if (creates.length === options.failAt) throw new Error('disk full');
      if (creates.length === options.deleteAt) state.nodes = [];
      if (creates.length === options.switchAt) state.projectId = 'other';
      return { id: options.missingId ? '' : `asset-${creates.length}` };
    } } },
    '../../stores/useCanvasStore': { useCanvasStore: { getState: () => state } },
    './canvasModel': { nodeRect },
  };
  runInNewContext(compiled, { exports, Error, crypto: globalThis.crypto, File, Blob, FileReader: Reader, Image: ImageMock,
    document: { createElement: () => canvas }, require: (name: string) => { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return { api: exports, state, source, additions, creates, draws, canvas };
};
const output = (width = 100, height = 80) => ({ file: new File(['png'], 'part.png', { type: 'image/png' }), width, height, title: 'part' });

test('grid uses floor boundaries in row-major order', () => {
  const rects = setup().api.gridImageRects(5, 3, 2, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(rects)), [
    { x: 0, y: 0, width: 2, height: 1 }, { x: 2, y: 0, width: 3, height: 1 },
    { x: 0, y: 1, width: 2, height: 2 }, { x: 2, y: 1, width: 3, height: 2 },
  ]);
});

test('all supported grids cover every pixel exactly once, including uneven sizes', () => {
  const { api } = setup();
  for (let width = 1; width <= 13; width++) for (let height = 1; height <= 11; height++) {
    for (let rows = 1; rows <= Math.min(6, height); rows++) for (let columns = 1; columns <= Math.min(6, width); columns++) {
      const pixels = new Uint8Array(width * height);
      for (const rect of api.gridImageRects(width, height, rows, columns)) {
        assert.ok(rect.width > 0 && rect.height > 0);
        for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) pixels[y * width + x]++;
      }
      assert.ok(pixels.every((count) => count === 1));
    }
  }
});

test('grid rejects nonpositive, fractional, nonfinite, unsafe and oversized arguments', () => {
  const { api } = setup();
  for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => api.gridImageRects(value, 10, 1, 1));
    assert.throws(() => api.gridImageRects(10, value, 1, 1));
    assert.throws(() => api.gridImageRects(10, 10, value, 1));
    assert.throws(() => api.gridImageRects(10, 10, 1, value));
  }
  for (const args of [[10, 10, 7, 1], [10, 10, 1, 7], [2, 2, 3, 1], [2, 2, 1, 3]]) assert.throws(() => api.gridImageRects(...args as [number, number, number, number]));
});

test('crop permits exact full-size and bottom-right boundaries without mutating input', () => {
  const { api } = setup();
  for (const rect of [{ x: 0, y: 0, width: 10, height: 8 }, { x: 9, y: 7, width: 1, height: 1 }]) {
    assert.equal(JSON.stringify(api.cropImageRect(10, 8, rect)), JSON.stringify(rect));
    assert.notEqual(api.cropImageRect(10, 8, rect), rect);
  }
});

test('crop rejects empty, fractional, negative and out-of-bounds regions', () => {
  const { api } = setup();
  for (const patch of [{ x: -1 }, { y: -1 }, { x: 0.5 }, { y: NaN }, { width: 0 }, { height: -1 }, { width: 1.5 }, { height: Infinity }, { x: 10 }, { y: 8 }, { width: 11 }, { height: 9 }]) {
    assert.throws(() => api.cropImageRect(10, 8, { x: 0, y: 0, width: 1, height: 1, ...patch }));
  }
  assert.throws(() => api.cropImageRect(0, 8, { x: 0, y: 0, width: 1, height: 1 }));
});

test('load uses encoded original asset URL and decoded natural dimensions', async () => {
  const image = await setup({ pixels: [8000, 4000] }).api.loadToolImage('a/b');
  assert.equal(image.src, '/api/assets/a%2Fb/original');
  assert.equal(image.naturalWidth * image.naturalHeight, 32_000_000);
  await assert.rejects(setup({ pixels: [8001, 4000] }).api.loadToolImage('a'), /3200/);
  await assert.rejects(setup({ pixels: [0, 1] }).api.loadToolImage('a'), /正整数/);
  await assert.rejects(setup({ decodeFail: true }).api.loadToolImage('a'), /解码失败/);
  await assert.rejects(setup().api.loadToolImage(''), /资产 ID/);
});

test('region draws exact source pixels to unscaled PNG output', async () => {
  const { api, draws, canvas } = setup();
  const image = await api.loadToolImage('a');
  const file = await api.imageRegionFile(image, { x: 3, y: 4, width: 7, height: 9 }, 'part.jpg');
  assert.equal(file.name, 'part.png'); assert.equal(file.type, 'image/png'); assert.ok(file.size);
  assert.deepEqual(draws[0].slice(1), [3, 4, 7, 9, 0, 0, 7, 9]);
  assert.equal(canvas.width, 7); assert.equal(canvas.height, 9);
});

test('region rejects empty exports and invalid rectangles', async () => {
  const { api } = setup({ emptyBlob: true });
  const image = await api.loadToolImage('a');
  await assert.rejects(api.imageRegionFile(image, { x: 0, y: 0, width: 2, height: 2 }, 'part'), /图片为空/);
  await assert.rejects(api.imageRegionFile(image, { x: 100, y: 0, width: 2, height: 2 }, 'part'), /边界/);
});

test('each operation persists provenance then adds standalone nodes once with no edges or overlap', async () => {
  for (const operation of ['crop', 'split', 'mask'] as const) {
    const { api, state, source, additions, creates } = setup();
    state.nodes.push({ ...source, id: 'blocker', position: { x: 440, y: 0 }, height: 1000 });
    const original = JSON.stringify(source);
    await api.saveToolOutputs('source', 'original', [output(), output(80, 200)], operation);
    assert.equal(additions.length, 1); assert.equal(additions[0].length, 1);
    const nodes = additions[0][0] as Node[];
    assert.equal(nodes.length, 2); assert.equal(JSON.stringify(source), original);
    assert.notEqual(nodes[0].id, nodes[1].id);
    assert.ok(nodes[0].position.y >= 1024);
    assert.ok(nodes[1].position.y >= nodes[0].position.y + nodes[0].height! + 24);
    assert.equal(nodes[0].data.assetId, 'asset-1'); assert.equal(nodes[0].data.imageWidth, 100); assert.equal(nodes[0].data.imageHeight, 80);
    assert.equal(nodes[0].data.aspectRatio, '1:1', 'generation ratio stays valid; display uses actual pixel dimensions');
    assert.equal(nodes[0].data.imageOriginalUrl, '/api/assets/asset-1/original');
    assert.equal(nodes[0].data.imageUrl, nodes[0].data.imageOriginalUrl);
    assert.equal(JSON.stringify(creates[0].userMetadata), JSON.stringify({ source: 'canvas', sourceAssetId: 'original', sourceNodeId: 'source', operation, width: 100, height: 80 }));
  }
});

test('partial save reports already-stored count and never adds partial nodes', async () => {
  const { api, additions, creates } = setup({ failAt: 2 });
  await assert.rejects(api.saveToolOutputs('source', 'original', [output(), output()], 'split'), /disk full.*已入库 1\/2/);
  assert.equal(creates.length, 2); assert.equal(additions.length, 0);
});

test('deleted source or switched project rejects before canvas publication', async () => {
  for (const options of [{ deleteAt: 1 }, { switchAt: 1 }]) {
    const { api, additions } = setup(options);
    await assert.rejects(api.saveToolOutputs('source', 'original', [output()], 'mask'), /源节点已删除或画布已切换.*已入库 1\/1/);
    assert.equal(additions.length, 0);
  }
  const { api, state, creates } = setup(); state.nodes = [];
  await assert.rejects(api.saveToolOutputs('source', 'original', [output()], 'crop'), /源节点已删除/);
  assert.equal(creates.length, 0);
});

test('invalid output, file read failure and missing asset ID cannot report success', async () => {
  const { api, creates } = setup();
  await assert.rejects(api.saveToolOutputs('source', 'original', [], 'crop'), /参数无效/);
  await assert.rejects(api.saveToolOutputs('source', 'original', [output(0)], 'crop'), /正整数/);
  await assert.rejects(api.saveToolOutputs('source', 'original', [{ ...output(), file: new File([], 'empty.png', { type: 'image/png' }) }], 'crop'), /非空 PNG/);
  assert.equal(creates.length, 0);
  for (const options of [{ readFail: true }, { missingId: true }]) {
    const run = setup(options);
    await assert.rejects(run.api.saveToolOutputs('source', 'original', [output()], 'crop'), /保存失败.*已入库 0\/1/);
    assert.equal(run.additions.length, 0);
  }
});
