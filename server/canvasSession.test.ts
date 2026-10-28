import assert from 'node:assert/strict';
import test from 'node:test';

const storage = new Map<string, string>();
const listeners = new Map<string, () => void>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
} });
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  localStorage: globalThis.localStorage,
  setTimeout, clearTimeout, addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
} });
Object.defineProperty(globalThis, 'document', { configurable: true, value: {
  visibilityState: 'hidden', addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
} });
const { useProjectStore } = await import('../src/stores/useProjectStore');
const { useCanvasStore, flushCanvasSave } = await import('../src/stores/useCanvasStore');
const node = (id: string, content = '') => ({ id, type: 'text', position: { x: 0, y: 0 }, data: { content } });

test('画布编辑会话保留项目与进入时快照，自动保存不改变放弃基线', () => {
  const id = useProjectStore.getState().createProject('会话测试');
  useProjectStore.getState().saveProjectCanvas(id, { nodes: [node('one', '原文')], edges: [] });
  useProjectStore.getState().beginCanvasSession(id);
  useCanvasStore.getState().loadProject(id, { nodes: [node('one', '原文')], edges: [] });
  useCanvasStore.getState().updateNode('one', { content: '修改' });
  flushCanvasSave();
  assert.equal(useProjectStore.getState().projects.find((p) => p.id === id)?.canvas?.nodes[0].data.content, '修改');
  assert.equal(useProjectStore.getState().canvasSession?.originalCanvas.nodes[0].data.content, '原文');
  const persisted = JSON.parse(storage.get('design-work-projects')!).state;
  assert.equal(persisted.canvasSession.projectId, id);
  assert.equal(persisted.projects[0].canvas.nodes[0].data.content, '修改');
});

test('切换全局项目不会将当前画布写入别的项目，切换画布项目先冲刷旧项目', () => {
  const first = useCanvasStore.getState().projectId!;
  const second = useProjectStore.getState().createProject('另一个项目');
  useCanvasStore.getState().updateNode('one', { content: '最后一个字' });
  useCanvasStore.getState().loadProject(second, { nodes: [node('two')], edges: [] });
  flushCanvasSave();
  assert.equal(useProjectStore.getState().projects.find((p) => p.id === first)?.canvas?.nodes[0].data.content, '最后一个字');
  assert.equal(useProjectStore.getState().projects.find((p) => p.id === second)?.canvas?.nodes[0].id, 'two');
});

test('关闭、离页和隐藏事件同步冲刷最后一次编辑，不等待防抖计时', () => {
  for (const event of ['pagehide', 'beforeunload', 'visibilitychange']) {
    useCanvasStore.getState().updateNode('two', { content: event });
    listeners.get(event)!();
    const id = useCanvasStore.getState().projectId;
    assert.equal(useProjectStore.getState().projects.find((p) => p.id === id)?.canvas?.nodes[0].data.content, event);
  }
});

test('画布页基线仅捕获一次，包含其他页与Agent记录', () => {
  const id = useCanvasStore.getState().projectId!;
  useProjectStore.getState().beginCanvasSession(id);
  const original = { boards: ['一', '二'], activeBoard: '二', snapshots: {}, messages: { 二: [] } };
  useProjectStore.getState().captureCanvasBoards(id, original);
  useProjectStore.getState().captureCanvasBoards(id, { ...original, boards: ['修改'] });
  assert.deepEqual(useProjectStore.getState().canvasSession?.originalBoards?.boards, ['一', '二']);
  useProjectStore.getState().endCanvasSession();
  assert.equal(useProjectStore.getState().canvasSession, null);
});
