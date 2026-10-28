import assert from 'node:assert/strict';
import test from 'node:test';
import type { Node } from '@xyflow/react';
import { groupBounds, groupMemberIds, nodeRect } from '../src/components/canvas/canvasModel';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} });
const { useCanvasStore } = await import('../src/stores/useCanvasStore');
const item = (id: string, x = 100, y = 100, width = 200, height = 120): Node => ({ id, type: 'text', position: { x, y }, width, height, data: {} });
const reset = () => {
  useCanvasStore.setState({ projectId: null, nodes: [item('a'), item('b', 400, 300, 320, 240)], edges: [{ id: 'ab', source: 'a', target: 'b' }], undoStack: [], redoStack: [], selectedNodes: [] });
  const id = useCanvasStore.getState().groupNodes(['a', 'b'])!;
  return { id, group: () => useCanvasStore.getState().nodes.find((node) => node.id === id)! };
};
const assertFitted = (id: string) => {
  const { nodes } = useCanvasStore.getState();
  const group = nodes.find((node) => node.id === id)!;
  const members = new Set(groupMemberIds(group, nodes));
  assert.deepEqual(nodeRect(group), groupBounds(nodes.filter((node) => members.has(node.id)).map(nodeRect)));
};

test('组内节点拖出原外框后仍保留归属，外框扩张、收缩并支持一次撤销重做', () => {
  const { id, group } = reset();
  const before = nodeRect(group());
  useCanvasStore.getState().commit();
  useCanvasStore.getState().onNodesChange([{ id: 'a', type: 'position', position: { x: -600, y: -300 }, dragging: true }]);
  assertFitted(id);
  assert.deepEqual(groupMemberIds(group(), useCanvasStore.getState().nodes), ['a', 'b']);
  assert.ok(nodeRect(group()).width > before.width);
  useCanvasStore.getState().onNodesChange([{ id: 'a', type: 'position', position: { x: 380, y: 280 }, dragging: false }]);
  assertFitted(id);
  assert.ok(nodeRect(group()).width < before.width);
  useCanvasStore.getState().undo();
  assert.deepEqual(nodeRect(group()), before);
  useCanvasStore.getState().redo();
  assertFitted(id);
});

test('旧分组按拖动前的位置恢复成员，节点尺寸变化也会更新外框', () => {
  const { id, group } = reset();
  useCanvasStore.getState().updateNode(id, { memberIds: undefined });
  useCanvasStore.getState().onNodesChange([{ id: 'a', type: 'position', position: { x: -900, y: 80 } }]);
  assert.deepEqual(group().data.memberIds, ['a', 'b']);
  useCanvasStore.getState().onNodesChange([{ id: 'b', type: 'dimensions', dimensions: { width: 600, height: 500 }, setAttributes: true }]);
  assertFitted(id);
  useCanvasStore.getState().onNodesChange([{ id, type: 'dimensions', dimensions: { width: 2200, height: 1000 }, setAttributes: true }]);
  assert.equal(nodeRect(group()).width, 2200);
  assert.equal(nodeRect(group()).height, 1000);
  assert.equal(group().style?.width, undefined);
});

for (const mode of ['grid', 'horizontal', 'vertical'] as const) {
  test(`分组${mode}排列使用实际尺寸，无重叠、不改变连线，撤销恢复`, () => {
    const { id } = reset();
    const before = useCanvasStore.getState().nodes;
    useCanvasStore.getState().arrangeGroup(id, mode);
    const { nodes, edges } = useCanvasStore.getState();
    const a = nodeRect(nodes.find((node) => node.id === 'a')!);
    const b = nodeRect(nodes.find((node) => node.id === 'b')!);
    assert.ok(a.x + a.width <= b.x || a.y + a.height <= b.y);
    assert.equal(edges.length, 1);
    assertFitted(id);
    useCanvasStore.getState().undo();
    assert.deepEqual(useCanvasStore.getState().nodes.map(nodeRect), before.map(nodeRect));
  });
}

test('解散保留内容和连线，删除分组及成员移除关联连线且可撤销', () => {
  let { id } = reset();
  useCanvasStore.getState().removeNodes([id]);
  assert.equal(useCanvasStore.getState().nodes.length, 2);
  assert.equal(useCanvasStore.getState().edges.length, 1);
  ({ id } = reset());
  useCanvasStore.getState().removeNodes([id, 'a', 'b']);
  assert.equal(useCanvasStore.getState().nodes.length, 0);
  assert.equal(useCanvasStore.getState().edges.length, 0);
  useCanvasStore.getState().undo();
  assert.equal(useCanvasStore.getState().nodes.length, 3);
});

test('锁定成员阻止排列；锁定分组不被自动缩放，删除跳过锁定成员', () => {
  const { id, group } = reset();
  useCanvasStore.getState().setLocked(['a'], true);
  const before = useCanvasStore.getState().nodes;
  useCanvasStore.getState().arrangeGroup(id, 'vertical');
  assert.equal(useCanvasStore.getState().nodes, before);
  useCanvasStore.getState().setLocked([id], true);
  const box = nodeRect(group());
  useCanvasStore.getState().onNodesChange([{ id: 'b', type: 'position', position: { x: 2000, y: 2000 } }]);
  assert.deepEqual(nodeRect(group()), box);
  useCanvasStore.getState().setLocked([id], false);
  useCanvasStore.getState().removeNodes([id, 'a', 'b']);
  assert.deepEqual(useCanvasStore.getState().nodes.map((node) => node.id), ['a']);
});

test('分组颜色和成员可保存恢复；复制后的成员 id 指向副本而非原节点', () => {
  const { id, group } = reset();
  useCanvasStore.getState().updateNode(id, { backgroundColor: '#3B82F6' }, { history: true });
  const snapshot = JSON.parse(JSON.stringify(useCanvasStore.getState().getSnapshot()));
  useCanvasStore.getState().restoreSnapshot(snapshot.nodes, snapshot.edges);
  assert.equal(group().data.backgroundColor, '#3B82F6');
  const ids = useCanvasStore.getState().duplicateNodes([id, 'a', 'b']);
  const copied = useCanvasStore.getState().nodes.find((node) => ids.includes(node.id) && node.type === 'group')!;
  const members = groupMemberIds(copied, useCanvasStore.getState().nodes);
  assert.equal(members.length, 2);
  assert.ok(members.every((member) => ids.includes(member) && member !== 'a' && member !== 'b'));
});
