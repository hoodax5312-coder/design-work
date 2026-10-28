import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeResultOf,
  alignPositions,
  buildAgentPrompt,
  carryGeneratedOutputs,
  clampCount,
  collectChain,
  composePrompt,
  GROUP_Z_INDEX,
  groupBounds,
  groupMemberIds,
  isInsideBox,
  layoutLayers,
  mergeResults,
  STALE_UPLOAD_ERROR,
  nextBoardName,
  nodeRect,
  normalizeRestoredCanvas,
  parseAgentPlan,
  resolveProjectBoards,
  videoResolutionForRatio,
} from '../src/components/canvas/canvasModel';

const node = (id: string, type = 'text', data: Record<string, unknown> = {}) => ({ id, type, position: { x: 0, y: 0 }, data });

test('旧版全局画布缓存只归属给节点重合的项目，并以项目画布为准', () => {
  const legacy = {
    boards: ['画布 1', '画布 2'],
    activeBoard: '画布 2',
    snapshots: {
      '画布 1': { nodes: [node('a'), node('b')], edges: [] },
      '画布 2': { nodes: [], edges: [] },
    },
    messages: {
      '画布 1': [
        { id: 'welcome', role: 'assistant', content: '当前正在操作「画布 1」。告诉我你想创建什么，我可以把文本、图片和视频任务直接放到这个画布。' },
        { id: 'm1', role: 'user', content: '你好' },
      ],
    },
  };
  const projectCanvas = { nodes: [node('a'), node('b'), node('c')], edges: [] };

  const owner = resolveProjectBoards(legacy, 'project-a', projectCanvas);
  assert.equal(owner.source, 'legacy');
  assert.equal(owner.boards.activeBoard, '画布 1');
  assert.deepEqual(owner.boards.snapshots['画布 1'].nodes.map((item) => item.id), ['a', 'b', 'c']);
  assert.deepEqual(owner.boards.messages['画布 1'].map((message) => message.id), ['m1'], '旧版固定开场白应在迁移时去掉');
  assert.equal(owner.cache.legacy, undefined);

  const other = resolveProjectBoards(legacy, 'project-b', { nodes: [], edges: [] });
  assert.equal(other.source, 'fresh');
  assert.deepEqual(other.boards.boards, ['画布 1']);
  assert.ok(other.cache.legacy, '未认领的旧缓存应保留，等待对应项目');
});

test('按项目读取已有画布页，损坏数据回落到单个空白画布页', () => {
  const cache = {
    version: 2,
    projects: {
      p1: { boards: ['画布 1', '分镜'], activeBoard: '分镜', snapshots: { 分镜: { nodes: [node('old')], edges: [] } }, messages: {} },
    },
  };
  const resolved = resolveProjectBoards(cache, 'p1', { nodes: [node('fresh')], edges: [] });
  assert.equal(resolved.source, 'project');
  assert.equal(resolved.boards.activeBoard, '分镜');
  assert.deepEqual(resolved.boards.snapshots['分镜'].nodes.map((item) => item.id), ['fresh']);
  assert.deepEqual(resolved.boards.snapshots['画布 1'], { nodes: [], edges: [] });

  for (const raw of [null, 'oops', { version: 2, projects: 'bad' }, { boards: [] }]) {
    const fallback = resolveProjectBoards(raw, 'p2', { nodes: [], edges: [] });
    assert.equal(fallback.source, 'fresh');
    assert.deepEqual(fallback.boards.boards, ['画布 1']);
  }
});

test('新画布页名称跳过已有编号', () => {
  assert.equal(nextBoardName(['画布 1', '画布 2']), '画布 3');
  assert.equal(nextBoardName(['画布 1', '画布 3']), '画布 4');
});

test('Agent 规划解析：代码块、别名、越界引用与非 JSON 回复', () => {
  const fenced = parseAgentPlan('好的\n```json\n{"reply":"已拆分","nodes":[{"type":"文本","title":"脚本","content":"第一幕"},{"type":"image","prompt":"海边日落","from":[0,0,3,-1]},{"type":"audio"}]}\n```');
  assert.equal(fenced.structured, true);
  assert.equal(fenced.plan.reply, '已拆分');
  // 音频（音乐）已是可规划节点；未知类型仍被丢弃。
  assert.deepEqual(fenced.plan.nodes.map((item) => item.type), ['text', 'imageGen', 'audio']);
  assert.deepEqual(fenced.plan.nodes[1].from, [0]);
  assert.equal(fenced.plan.nodes[0].content, '第一幕');

  const many = parseAgentPlan(JSON.stringify({ nodes: Array.from({ length: 9 }, () => ({ type: 'text', content: 'x' })) }));
  assert.equal(many.plan.nodes.length, 6);
  assert.equal(many.plan.reply, '已规划 6 个节点。');

  const plain = parseAgentPlan('抱歉，我只能回答问题。');
  assert.equal(plain.structured, false);
  assert.equal(plain.plan.nodes.length, 0);
  assert.equal(plain.plan.reply, '抱歉，我只能回答问题。');

  assert.equal(parseAgentPlan('{broken').structured, false);
  assert.equal(parseAgentPlan('').plan.reply, '模型没有返回内容。');
});

test('Agent 指令包含协议、画布上下文与需求', () => {
  const prompt = buildAgentPrompt('做三张海报', { board: '画布 1', nodes: [{ type: 'text', title: '文案', summary: '夏日饮品', selected: true }] });
  assert.match(prompt, /只输出一个 JSON 对象/);
  assert.match(prompt, /\[文本\]（已选中） 文案：夏日饮品/);
  assert.match(prompt, /用户需求：做三张海报$/);
});

test('上游文本作为参考拼在提示词前，自身为空时只用参考', () => {
  assert.equal(composePrompt('  画一只猫 ', []), '画一只猫');
  assert.equal(composePrompt('画一只猫', [{ title: '设定', text: '橘色' }, { title: '空', text: '  ' }]), '【设定】\n橘色\n\n画一只猫');
  assert.equal(composePrompt('', [{ title: '', text: '脚本' }]), '【参考文本】\n脚本');
});

test('整理布局按依赖分列，并忽略环', () => {
  const items = ['a', 'b', 'c', 'd'].map((id, index) => ({ id, x: 100, y: index * 10, width: 200, height: 100 }));
  const positions = layoutLayers(items, [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'a' },
    { source: 'a', target: 'd' },
  ]);
  const xs = new Set(Object.values(positions).map((position) => position.x));
  assert.ok(xs.size >= 2, '有依赖时至少分成两列');
  assert.ok(positions.b.x > positions.a.x || positions.a.x > positions.c.x);
  assert.equal(Object.keys(positions).length, 4);
});

test('恢复画布时清理过渡状态并补默认尺寸', () => {
  const nodes: Array<ReturnType<typeof node> & { selected?: boolean; width?: number; height?: number }> = [
    { ...node('t', 'text', { prompt: '同一段', content: '同一段', isGenerating: true }), selected: true },
    node('i', 'imageGen', { isGenerating: true }),
  ];
  const restored = normalizeRestoredCanvas({
    nodes,
    edges: [{ id: 'e', source: 't', target: 'i', type: 'smoothstep', animated: true }],
  }, (id) => id === 'i');
  assert.equal(restored.nodes[0].data.prompt, '');
  assert.equal(restored.nodes[0].data.isGenerating, false);
  assert.equal(restored.nodes[0].selected, false);
  assert.equal(restored.nodes[0].width, 320);
  assert.equal(restored.nodes[0].height, 200);
  assert.equal(restored.nodes[1].data.isGenerating, true);
  assert.equal(restored.edges[0].type, 'flow');
  assert.equal(restored.edges[0].animated, false);
});

test('视频分辨率与视频工作台保持一致', () => {
  assert.equal(videoResolutionForRatio('16:9'), '480x320');
  assert.equal(videoResolutionForRatio('9:16'), '320x480');
  assert.equal(videoResolutionForRatio('1:1'), '480x480');
});

test('对齐与分布按选区外框计算，分布至少需要三个节点', () => {
  const items = [
    { id: 'a', x: 0, y: 0, width: 100, height: 50 },
    { id: 'b', x: 300, y: 80, width: 100, height: 100 },
    { id: 'c', x: 140, y: 40, width: 60, height: 50 },
  ];
  assert.deepEqual(alignPositions(items, 'left').b, { x: 0, y: 80 });
  assert.deepEqual(alignPositions(items, 'right').a, { x: 300, y: 0 });
  assert.deepEqual(alignPositions(items, 'vcenter').a, { x: 0, y: 65 });
  const spread = alignPositions(items, 'hdistribute');
  // 外框 0–400，占用 260，两段间距各 70。
  assert.deepEqual(spread.a, { x: 0, y: 0 });
  assert.deepEqual(spread.c, { x: 170, y: 40 });
  assert.deepEqual(spread.b, { x: 300, y: 80 });
  assert.deepEqual(alignPositions(items.slice(0, 2), 'hdistribute'), {});
  assert.deepEqual(alignPositions(items.slice(0, 1), 'left'), {});
});

test('分组框包住所选节点，组内判断以节点中心为准', () => {
  const box = groupBounds([{ x: 100, y: 100, width: 200, height: 100 }, { x: 400, y: 150, width: 100, height: 100 }]);
  assert.deepEqual(box, { x: 60, y: 36, width: 480, height: 254 });
  assert.equal(isInsideBox({ x: 100, y: 100, width: 200, height: 100 }, box), true);
  assert.equal(isInsideBox({ x: 520, y: 100, width: 100, height: 100 }, box), false);
});

test('链路收集沿连线向下游或上游展开，并能处理环', () => {
  const edges = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'x', target: 'c' },
    { source: 'c', target: 'a' },
  ];
  assert.deepEqual(collectChain('b', edges.slice(0, 3), 'down').sort(), ['b', 'c']);
  assert.deepEqual(collectChain('c', edges.slice(0, 3), 'up').sort(), ['a', 'b', 'c', 'x']);
  assert.deepEqual(collectChain('a', edges, 'down').sort(), ['a', 'b', 'c']);
});

test('生成张数限制在 1–4，结果按 id 去重并只保留最近若干条', () => {
  assert.equal(clampCount(0), 1);
  assert.equal(clampCount('3'), 3);
  assert.equal(clampCount(9), 4);
  assert.equal(clampCount(undefined), 1);
  const r = (id: string, createdAt: number) => ({ id, url: `data:${id}`, prompt: 'p', createdAt });
  const merged = mergeResults([r('a', 1), r('b', 2)], [r('b', 2), r('c', 3), r('d', 4)], 3);
  assert.deepEqual(merged.map((item) => item.id), ['b', 'c', 'd']);
});

test('撤销恢复旧快照时保留之后生成的结果', () => {
  const result = { id: 'r1', url: 'data:image/png;base64,AA', prompt: 'p', createdAt: 1 };
  const restored = [node('i', 'imageGen', { prompt: '旧提示词' }), node('t', 'text', { content: '旧' })];
  const current = [node('i', 'imageGen', { prompt: '新提示词', imageUrl: result.url, activeResultId: 'r1', results: [result] }), node('t', 'text', { content: '新' })];
  const carried = carryGeneratedOutputs(restored, current);
  assert.equal(carried[0].data.prompt, '旧提示词');
  assert.equal(carried[0].data.imageUrl, result.url);
  assert.equal(carried[0].data.activeResultId, 'r1');
  assert.equal((carried[0].data.results as unknown[]).length, 1);
  assert.equal(carried[1], restored[1]);
});

test('恢复画布时清理失效的本地素材地址，并把分组固定在最底层', () => {
  const restored = normalizeRestoredCanvas({
    nodes: [
      node('u', 'imageGen', { imageUrl: 'blob:http://localhost/dead', uploading: true }),
      node('l', 'imageGen', { imageUrl: 'blob:http://localhost/live' }),
      node('g', 'group', { title: '分镜' }),
      node('n', 'note', { content: '备注' }),
    ],
    edges: [],
  }, () => false, (url) => url.endsWith('/live'));
  assert.equal(restored.nodes[0].data.imageUrl, undefined);
  assert.equal(restored.nodes[0].data.error, STALE_UPLOAD_ERROR);
  assert.equal(restored.nodes[0].data.uploading, false);
  assert.equal(restored.nodes[1].data.imageUrl, 'blob:http://localhost/live');
  assert.equal((restored.nodes[2] as { zIndex?: number }).zIndex, GROUP_Z_INDEX);
  assert.equal((restored.nodes[2] as { width?: number }).width, 640);
  assert.equal((restored.nodes[3] as { height?: number }).height, 180);
});

test('节点矩形优先使用渲染后的尺寸，缺省时按 320×240 估算', () => {
  const at = { x: 10, y: 20 };
  assert.deepEqual(nodeRect({ id: 'a', type: 'text', position: at, width: 300, height: 200, measured: { width: 280, height: 160 } }), { x: 10, y: 20, width: 280, height: 160 });
  assert.deepEqual(nodeRect({ id: 'b', type: 'text', position: at, width: 300 }), { x: 10, y: 20, width: 300, height: 240 });
  assert.deepEqual(nodeRect({ id: 'c', type: 'text', position: at }), { x: 10, y: 20, width: 320, height: 240 });
});

test('分组按位置收纳节点：中心落在框内才算，分组自身和其他分组不算', () => {
  const group = { id: 'g', type: 'group', position: { x: 0, y: 0 }, width: 800, height: 600 };
  const nodes = [
    group,
    { id: 'inside', type: 'imageGen', position: { x: 40, y: 60 }, width: 200, height: 200 },
    { id: 'straddle', type: 'text', position: { x: 700, y: 100 }, measured: { width: 80, height: 80 } },
    { id: 'outside', type: 'text', position: { x: 760, y: 100 }, measured: { width: 200, height: 80 } },
    { id: 'note', type: 'note', position: { x: 300, y: 300 }, width: 240, height: 180 },
    { id: 'nested', type: 'group', position: { x: 100, y: 100 }, width: 200, height: 200 },
  ];
  assert.deepEqual(groupMemberIds(group, nodes), ['inside', 'straddle', 'note']);
  assert.deepEqual(groupMemberIds({ ...group, position: { x: 5000, y: 5000 } }, nodes), []);
});

test('当前主结果先按 activeResultId，再按地址匹配，都对不上时返回 undefined', () => {
  const r = (id: string) => ({ id, url: `/api/assets/${id}/preview?size=1024`, prompt: 'p', createdAt: 1 });
  const results = [r('a'), r('b')];
  assert.equal(activeResultOf({ results, activeResultId: 'b', imageUrl: r('a').url }, 'imageUrl')?.id, 'b');
  assert.equal(activeResultOf({ results, imageUrl: r('a').url }, 'imageUrl')?.id, 'a');
  assert.equal(activeResultOf({ results, previewUrl: r('b').url }, 'previewUrl')?.id, 'b');
  assert.equal(activeResultOf({ results, imageUrl: 'blob:http://localhost/x' }, 'imageUrl'), undefined);
  assert.equal(activeResultOf(undefined, 'imageUrl'), undefined);
});
