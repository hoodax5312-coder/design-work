/**
 * 画布的纯数据逻辑：节点默认值、整理布局、画布缓存迁移、Agent 规划解析与提示词拼接。
 * 不依赖 DOM 与 React Flow 运行时，便于在 server 侧用 node:test 验证。
 */

export type CanvasNodeKind = 'text' | 'imageGen' | 'video';

export interface CanvasNodeLike {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  width?: number;
  height?: number;
  selected?: boolean;
}

export interface CanvasEdgeLike {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
}

export const NODE_KINDS: CanvasNodeKind[] = ['text', 'imageGen', 'video'];

export const DEFAULT_NODE_SIZE: Record<CanvasNodeKind, { width: number; height?: number }> = {
  text: { width: 320, height: 200 },
  imageGen: { width: 320 },
  video: { width: 400 },
};

export const NODE_KIND_LABEL: Record<CanvasNodeKind, string> = { text: '文本', imageGen: '图片', video: '视频' };

export const isCanvasNodeKind = (value: unknown): value is CanvasNodeKind =>
  value === 'text' || value === 'imageGen' || value === 'video';

/** 标注类节点：便签与分组。不参与生成、连线、整理布局和 Agent 上下文。 */
export type CanvasAnnotationKind = 'note' | 'group';

export const isAnnotationKind = (value: unknown): value is CanvasAnnotationKind => value === 'note' || value === 'group';

export const ANNOTATION_LABEL: Record<CanvasAnnotationKind, string> = { note: '便签', group: '分组' };

export const ANNOTATION_SIZE: Record<CanvasAnnotationKind, { width: number; height: number }> = {
  note: { width: 240, height: 180 },
  group: { width: 640, height: 400 },
};

/** 分组始终画在连线与普通节点之下；选中时 React Flow 会加 1000，仍低于普通节点。 */
export const GROUP_Z_INDEX = -2000;

export const NOTE_TINTS = ['neutral', 'amber', 'sky', 'mint', 'rose'] as const;
export type NoteTint = (typeof NOTE_TINTS)[number];

export const annotationData = (kind: CanvasAnnotationKind): Record<string, unknown> =>
  kind === 'note' ? { content: '', tint: 'amber' } : { title: '' };

export const defaultNodeData = (kind: CanvasNodeKind): Record<string, unknown> => {
  if (kind === 'text') return { content: '', prompt: '', mode: 'edit' };
  if (kind === 'video') return { prompt: '', model: '', aspectRatio: '16:9', resolution: '1080p', duration: 5 };
  return { prompt: '', model: '', style: '', resolution: '1k', aspectRatio: '1:1', quality: 'standard', isFocusMode: false };
};

export const nodeTitle = (node: Pick<CanvasNodeLike, 'type' | 'data'>) => {
  const custom = typeof node.data?.title === 'string' ? node.data.title.trim() : '';
  if (custom) return custom;
  if (isAnnotationKind(node.type)) return ANNOTATION_LABEL[node.type];
  return isCanvasNodeKind(node.type) ? NODE_KIND_LABEL[node.type] : '节点';
};

/** 节点在 Agent 上下文与搜索里的一行摘要。 */
export const nodeSummary = (node: Pick<CanvasNodeLike, 'type' | 'data'>, max = 80) => {
  const raw = String(node.type === 'text' || node.type === 'note' ? node.data?.content || node.data?.prompt || '' : node.data?.prompt || '');
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

export const STALE_UPLOAD_ERROR = '本地素材只在放入时的会话内有效，刷新后已失效，请重新放入';

/**
 * 从存储恢复画布时清理过渡状态：没有在途请求的节点不应停在"生成中"或"上传中"，
 * 已失效的本地 blob 地址清空并提示重新放入，旧版连线统一换成画布连线，
 * 旧版文本节点里与正文重复的提示词清空，缺失尺寸补默认值，分组固定在最底层。
 */
export const normalizeRestoredCanvas = <N extends CanvasNodeLike, E extends CanvasEdgeLike>(
  canvas: { nodes: N[]; edges: E[] },
  isRunning: (id: string) => boolean = () => false,
  isLiveObjectUrl: (url: string) => boolean = () => true,
): { nodes: N[]; edges: E[] } => ({
  nodes: (canvas.nodes || []).map((node) => {
    const data = { ...(node.data || {}) };
    if (data.isGenerating && !isRunning(node.id)) data.isGenerating = false;
    if (data.uploading && !isRunning(node.id)) data.uploading = false;
    if (node.type === 'text' && data.prompt && data.prompt === data.content) data.prompt = '';
    (['imageUrl', 'previewUrl'] as const).forEach((key) => {
      const url = data[key];
      if (typeof url === 'string' && url.startsWith('blob:') && !isLiveObjectUrl(url)) {
        data[key] = undefined;
        data.error = STALE_UPLOAD_ERROR;
      }
    });
    const size = isCanvasNodeKind(node.type) ? DEFAULT_NODE_SIZE[node.type] : isAnnotationKind(node.type) ? ANNOTATION_SIZE[node.type] : undefined;
    return {
      ...node,
      selected: false,
      data,
      ...(node.type === 'group' ? { zIndex: GROUP_Z_INDEX } : {}),
      ...(data.locked ? { draggable: false, deletable: false } : {}),
      ...(size && typeof node.width !== 'number' ? { width: size.width } : {}),
      ...(size?.height && typeof node.height !== 'number' ? { height: size.height } : {}),
    } as N;
  }),
  edges: (canvas.edges || []).map((edge) => ({ ...edge, type: 'flow', animated: false }) as E),
});

/* ---------------- 生成结果与版本 ---------------- */

export interface CanvasResult {
  id: string;
  url: string;
  /** 已存入资产库时的资产 id；原地址失效时可回退到资产预览。 */
  assetId?: string;
  prompt: string;
  model?: string;
  createdAt: number;
  durationMs?: number;
}

export const MAX_RESULTS = 24;
export const IMAGE_COUNTS = [1, 2, 3, 4] as const;

export const clampCount = (value: unknown) => Math.min(4, Math.max(1, Math.round(Number(value) || 1)));

const isResult = (value: unknown): value is CanvasResult =>
  isRecordLike(value) && typeof value.id === 'string' && typeof value.url === 'string' && Boolean(value.url);

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export const readResults = (data: Record<string, unknown> | undefined): CanvasResult[] =>
  Array.isArray(data?.results) ? (data.results as unknown[]).filter(isResult) : [];

/** 资产库预览地址：入库后的结果用它代替会过期的供应商临时链接。 */
export const assetPreviewUrl = (assetId: string, size = 1024) => `/api/assets/${assetId}/preview?size=${size}`;

/** 当前主结果：优先按 activeResultId，其次按地址匹配；都对不上时返回 undefined，由调用方决定退回哪一条。 */
export const activeResultOf = (data: Record<string, unknown> | undefined, urlKey: 'imageUrl' | 'previewUrl') => {
  const results = readResults(data);
  return results.find((result) => result.id === data?.activeResultId)
    || results.find((result) => result.url === data?.[urlKey])
    || undefined;
};

/** 追加结果：按 id 去重、按时间排序，只保留最近 limit 条。 */
export const mergeResults = (current: CanvasResult[], added: CanvasResult[], limit = MAX_RESULTS) => {
  const byId = new Map<string, CanvasResult>();
  [...current, ...added].forEach((result) => byId.set(result.id, { ...byId.get(result.id), ...result }));
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-limit);
};

/**
 * 撤销 / 重做恢复的是快照，快照里可能还没有之后生成的结果。
 * 生成按次计费，结果不应因为撤销一次文字编辑而丢失：把现有结果合并回恢复后的节点。
 */
export const carryGeneratedOutputs = <N extends CanvasNodeLike>(restored: N[], current: N[]): N[] => {
  const live = new Map(current.map((node) => [node.id, node]));
  return restored.map((node) => {
    const now = live.get(node.id);
    if (!now || (node.type !== 'imageGen' && node.type !== 'video')) return node;
    const latest = readResults(now.data);
    if (!latest.length) return node;
    // 以当前结果为准合并：入库后结果地址会换成资产库地址，旧快照里的地址可能已失效。
    const results = mergeResults(readResults(node.data), latest);
    const key = node.type === 'video' ? 'previewUrl' : 'imageUrl';
    const keepActive = Boolean(node.data?.[key]);
    const active = keepActive ? results.find((result) => result.id === node.data?.activeResultId) : undefined;
    return {
      ...node,
      data: {
        ...node.data,
        results,
        ...(keepActive
          ? active ? { [key]: active.url } : {}
          : { [key]: now.data?.[key], activeResultId: now.data?.activeResultId }),
      },
    };
  });
};

/* ---------------- 对齐与分布 ---------------- */

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' | 'hdistribute' | 'vdistribute';

export const alignPositions = (
  items: Array<{ id: string; x: number; y: number; width: number; height: number }>,
  mode: AlignMode,
): Record<string, { x: number; y: number }> => {
  if (items.length < 2) return {};
  const left = Math.min(...items.map((item) => item.x));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const top = Math.min(...items.map((item) => item.y));
  const bottom = Math.max(...items.map((item) => item.y + item.height));
  const positions: Record<string, { x: number; y: number }> = {};
  const place = (item: { id: string; x: number; y: number }, x: number, y: number) => {
    positions[item.id] = { x: Math.round(x), y: Math.round(y) };
  };
  if (mode === 'hdistribute' || mode === 'vdistribute') {
    if (items.length < 3) return {};
    const horizontal = mode === 'hdistribute';
    const sorted = [...items].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
    const span = horizontal ? right - left : bottom - top;
    const occupied = sorted.reduce((sum, item) => sum + (horizontal ? item.width : item.height), 0);
    const gap = (span - occupied) / (sorted.length - 1);
    let cursor = horizontal ? left : top;
    sorted.forEach((item) => {
      if (horizontal) place(item, cursor, item.y);
      else place(item, item.x, cursor);
      cursor += (horizontal ? item.width : item.height) + gap;
    });
    return positions;
  }
  items.forEach((item) => {
    if (mode === 'left') place(item, left, item.y);
    if (mode === 'right') place(item, right - item.width, item.y);
    if (mode === 'hcenter') place(item, (left + right) / 2 - item.width / 2, item.y);
    if (mode === 'top') place(item, item.x, top);
    if (mode === 'bottom') place(item, item.x, bottom - item.height);
    if (mode === 'vcenter') place(item, item.x, (top + bottom) / 2 - item.height / 2);
  });
  return positions;
};

/** 分组框：包住所选节点，四周留白，顶部多留出标题位置。 */
export const groupBounds = (
  items: Array<{ x: number; y: number; width: number; height: number }>,
  padding = { x: 40, top: 64, bottom: 40 },
) => {
  const left = Math.min(...items.map((item) => item.x));
  const right = Math.max(...items.map((item) => item.x + item.width));
  const top = Math.min(...items.map((item) => item.y));
  const bottom = Math.max(...items.map((item) => item.y + item.height));
  return {
    x: Math.round(left - padding.x),
    y: Math.round(top - padding.top),
    width: Math.round(right - left + padding.x * 2),
    height: Math.round(bottom - top + padding.top + padding.bottom),
  };
};

/** 中心点落在分组框内的节点视为组内节点。 */
export const isInsideBox = (
  item: { x: number; y: number; width: number; height: number },
  box: { x: number; y: number; width: number; height: number },
) => {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  return cx > box.x && cx < box.x + box.width && cy > box.y && cy < box.y + box.height;
};

type SizedNode = Pick<CanvasNodeLike, 'id' | 'type' | 'position' | 'width' | 'height'> & { measured?: { width?: number; height?: number } };

/** 节点在画布坐标中的矩形：优先用渲染后的实际尺寸。 */
export const nodeRect = (node: SizedNode) => ({
  x: node.position.x,
  y: node.position.y,
  width: node.measured?.width ?? node.width ?? 320,
  height: node.measured?.height ?? node.height ?? 240,
});

/** 分组内的节点：不使用 parentId，按位置判断，分组本身和其他分组不算在内。 */
export const groupMemberIds = (group: SizedNode, nodes: SizedNode[]) => {
  const box = nodeRect(group);
  return nodes
    .filter((node) => node.id !== group.id && node.type !== 'group' && isInsideBox(nodeRect(node), box))
    .map((node) => node.id);
};

/** 沿连线收集链路：down 为自身及全部下游，up 为自身及全部上游。 */
export const collectChain = (id: string, edges: Array<Pick<CanvasEdgeLike, 'source' | 'target'>>, direction: 'down' | 'up') => {
  const next = new Map<string, string[]>();
  edges.forEach((edge) => {
    const [from, to] = direction === 'down' ? [edge.source, edge.target] : [edge.target, edge.source];
    next.set(from, [...(next.get(from) || []), to]);
  });
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(next.get(current) || []));
  }
  return [...seen];
};

interface LayoutItem { id: string; x: number; y: number; width: number; height: number }

/** 按连线依赖分列：无上游的节点在第一列，下游依次向右；同列按原有纵向顺序排列并居中对齐。 */
export const layoutLayers = (
  items: LayoutItem[],
  edges: Array<Pick<CanvasEdgeLike, 'source' | 'target'>>,
  gap = { x: 96, y: 72 },
): Record<string, { x: number; y: number }> => {
  if (!items.length) return {};
  const ids = new Set(items.map((item) => item.id));
  const parents = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) return;
    parents.set(edge.target, [...(parents.get(edge.target) || []), edge.source]);
  });
  const depthCache = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (id: string): number => {
    if (depthCache.has(id)) return depthCache.get(id) as number;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const depth = Math.max(0, ...(parents.get(id) || []).map((parent) => depthOf(parent) + 1));
    visiting.delete(id);
    depthCache.set(id, depth);
    return depth;
  };
  const columns = new Map<number, LayoutItem[]>();
  items.forEach((item) => {
    const depth = depthOf(item.id);
    columns.set(depth, [...(columns.get(depth) || []), item]);
  });
  const originX = Math.min(...items.map((item) => item.x));
  const originY = Math.min(...items.map((item) => item.y));
  const ordered = [...columns.entries()].sort(([a], [b]) => a - b);
  const columnHeight = (column: LayoutItem[]) => column.reduce((sum, item) => sum + item.height, 0) + gap.y * (column.length - 1);
  const tallest = Math.max(...ordered.map(([, column]) => columnHeight(column)));
  const positions: Record<string, { x: number; y: number }> = {};
  let x = originX;
  ordered.forEach(([, column]) => {
    column.sort((a, b) => a.y - b.y || a.x - b.x);
    let y = originY + (tallest - columnHeight(column)) / 2;
    column.forEach((item) => {
      positions[item.id] = { x: Math.round(x), y: Math.round(y) };
      y += item.height + gap.y;
    });
    x += Math.max(...column.map((item) => item.width)) + gap.x;
  });
  return positions;
};

/* ---------------- 画布缓存：按项目区分画布页 ---------------- */

export interface AgentPlanNode {
  type: CanvasNodeKind;
  title: string;
  prompt: string;
  content: string;
  /** 上游节点在本次规划中的序号。 */
  from: number[];
}

export interface AgentPlan {
  reply: string;
  nodes: AgentPlanNode[];
}

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tone?: 'error';
  plan?: AgentPlan;
  /** 规划已放入画布后对应的节点 id。 */
  nodeIds?: string[];
  createdAt?: number;
}

export interface BoardSnapshot {
  nodes: CanvasNodeLike[];
  edges: CanvasEdgeLike[];
}

export interface ProjectBoards {
  boards: string[];
  activeBoard: string;
  snapshots: Record<string, BoardSnapshot>;
  messages: Record<string, StoredChatMessage[]>;
}

export interface CanvasWorkspaceCache {
  version: 2;
  projects: Record<string, ProjectBoards>;
  /** 旧版全局缓存，等待归属到与其节点一致的项目。 */
  legacy?: ProjectBoards;
}

export const DEFAULT_BOARD = '画布 1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isProjectBoards = (value: unknown): value is ProjectBoards =>
  isRecord(value) && Array.isArray(value.boards) && value.boards.some((board) => typeof board === 'string' && board.trim());

const sanitizeSnapshot = (value: unknown): BoardSnapshot => ({
  nodes: isRecord(value) && Array.isArray(value.nodes) ? (value.nodes as CanvasNodeLike[]) : [],
  edges: isRecord(value) && Array.isArray(value.edges) ? (value.edges as CanvasEdgeLike[]) : [],
});

/** 旧版画布会给每个画布页预置一条固定开场白；它不是用户内容，迁移时去掉，让空对话显示建议。 */
const isLegacyGreeting = (message: StoredChatMessage) =>
  message.role === 'assistant' && /^当前正在操作「[^」]*」。告诉我你想创建什么/.test(message.content);

const sanitizeBoards = (value: ProjectBoards): ProjectBoards => {
  const boards = [...new Set(value.boards.filter((board): board is string => typeof board === 'string' && Boolean(board.trim())))];
  const activeBoard = boards.includes(value.activeBoard) ? value.activeBoard : boards[0];
  const snapshots: Record<string, BoardSnapshot> = {};
  const messages: Record<string, StoredChatMessage[]> = {};
  boards.forEach((board) => {
    snapshots[board] = sanitizeSnapshot(isRecord(value.snapshots) ? value.snapshots[board] : undefined);
    const list = isRecord(value.messages) ? value.messages[board] : undefined;
    messages[board] = Array.isArray(list)
      ? list
        .filter((message): message is StoredChatMessage => isRecord(message) && typeof message.content === 'string' && (message.role === 'user' || message.role === 'assistant'))
        .filter((message) => !isLegacyGreeting(message))
      : [];
  });
  return { boards, activeBoard, snapshots, messages };
};

const withActiveSnapshot = (boards: ProjectBoards, canvas: BoardSnapshot, activeBoard = boards.activeBoard): ProjectBoards => ({
  ...boards,
  activeBoard,
  snapshots: { ...boards.snapshots, [activeBoard]: canvas },
});

/** 旧缓存中与项目节点重合最多的画布页；没有重合返回 null。 */
const matchLegacyBoard = (legacy: ProjectBoards, canvas: BoardSnapshot) => {
  const ids = new Set(canvas.nodes.map((node) => node.id));
  if (!ids.size) return null;
  let best: { board: string; overlap: number } | null = null;
  legacy.boards.forEach((board) => {
    const overlap = (legacy.snapshots[board]?.nodes || []).filter((node) => ids.has(node.id)).length;
    if (overlap && (!best || overlap > best.overlap)) best = { board, overlap };
  });
  return (best as { board: string } | null)?.board ?? null;
};

/**
 * 读取某个项目的画布页。项目自身保存的画布始终作为当前画布页的内容；
 * 旧版全局缓存只会归属给节点与之重合的项目，其余项目从单个空白画布页开始。
 */
export const resolveProjectBoards = (raw: unknown, projectId: string, projectCanvas: BoardSnapshot) => {
  const cache: CanvasWorkspaceCache = { version: 2, projects: {} };
  if (isRecord(raw) && raw.version === 2 && isRecord(raw.projects)) {
    Object.entries(raw.projects).forEach(([id, value]) => {
      if (isProjectBoards(value)) cache.projects[id] = sanitizeBoards(value);
    });
    if (isProjectBoards(raw.legacy)) cache.legacy = sanitizeBoards(raw.legacy);
  } else if (isProjectBoards(raw)) {
    cache.legacy = sanitizeBoards(raw);
  }

  const canvas = sanitizeSnapshot(projectCanvas);
  const existing = cache.projects[projectId];
  if (existing) {
    const boards = withActiveSnapshot(existing, canvas);
    cache.projects[projectId] = boards;
    return { cache, boards, source: 'project' as const };
  }
  const legacyBoard = cache.legacy ? matchLegacyBoard(cache.legacy, canvas) : null;
  if (cache.legacy && legacyBoard) {
    const boards = withActiveSnapshot(cache.legacy, canvas, legacyBoard);
    delete cache.legacy;
    cache.projects[projectId] = boards;
    return { cache, boards, source: 'legacy' as const };
  }
  const boards: ProjectBoards = { boards: [DEFAULT_BOARD], activeBoard: DEFAULT_BOARD, snapshots: { [DEFAULT_BOARD]: canvas }, messages: { [DEFAULT_BOARD]: [] } };
  cache.projects[projectId] = boards;
  return { cache, boards, source: 'fresh' as const };
};

/** 新画布页名称：跳过已存在的编号。 */
export const nextBoardName = (boards: string[]) => {
  let index = boards.length + 1;
  while (boards.includes(`画布 ${index}`)) index += 1;
  return `画布 ${index}`;
};

/* ---------------- Agent：规划协议 ---------------- */

export const AGENT_MAX_NODES = 6;

export interface AgentContextNode {
  type: CanvasNodeKind;
  title: string;
  summary: string;
  selected?: boolean;
}

const TYPE_ALIASES: Record<string, CanvasNodeKind> = {
  text: 'text', 文本: 'text', copy: 'text',
  image: 'imageGen', imagegen: 'imageGen', 图片: 'imageGen', 图像: 'imageGen', picture: 'imageGen',
  video: 'video', 视频: 'video',
};

/** 生成发给文本模型的单条指令：说明 JSON 协议、当前画布与用户需求。 */
export const buildAgentPrompt = (request: string, context: { board: string; nodes: AgentContextNode[] }) => {
  const nodeLines = context.nodes.length
    ? context.nodes.slice(0, 16).map((node, index) => `${index + 1}. [${NODE_KIND_LABEL[node.type]}]${node.selected ? '（已选中）' : ''} ${node.title}${node.summary ? `：${node.summary}` : ''}`).join('\n')
    : '（空画布）';
  return [
    '你是「栗作」创作画布里的助手，负责把用户需求拆成画布节点。',
    '只输出一个 JSON 对象，不要输出解释、Markdown 或代码块标记。格式：',
    '{"reply":"给用户的简短答复","nodes":[{"type":"text | image | video","title":"节点标题，12 字以内","prompt":"图片或视频的生成提示词","content":"文本节点的正文","from":[上游节点在 nodes 数组中的序号，从 0 开始]}]}',
    '规则：',
    `- 最多 ${AGENT_MAX_NODES} 个节点；只需要回答问题时 nodes 为空数组。`,
    '- 文本节点直接写好 content；图片、视频节点写清 prompt（主体、风格、构图、光线、镜头）。',
    '- 一个节点以另一个节点为依据时，用 from 指向它；只能指向排在前面的节点。',
    '- 使用与用户相同的语言。',
    '',
    `当前画布页「${context.board}」已有节点：`,
    nodeLines,
    '',
    `用户需求：${request}`,
  ].join('\n');
};

const extractJsonObject = (text: string) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : '';
};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** 解析模型输出；不是合法 JSON 时把原文当作普通回复，不创建节点。 */
export const parseAgentPlan = (raw: string): { plan: AgentPlan; structured: boolean } => {
  const text = (raw || '').trim();
  const candidate = extractJsonObject(text);
  if (candidate) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (isRecord(parsed)) {
        const list = Array.isArray(parsed.nodes) ? parsed.nodes : [];
        const nodes: AgentPlanNode[] = [];
        list.forEach((item) => {
          if (!isRecord(item) || nodes.length >= AGENT_MAX_NODES) return;
          const type = TYPE_ALIASES[asText(item.type).toLowerCase()];
          if (!type) return;
          const own = nodes.length;
          const from = (Array.isArray(item.from) ? item.from : [])
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0 && value < own);
          nodes.push({
            type,
            title: asText(item.title).slice(0, 24) || NODE_KIND_LABEL[type],
            prompt: asText(item.prompt),
            content: type === 'text' ? asText(item.content) || asText(item.prompt) : '',
            from: [...new Set(from)],
          });
        });
        const reply = asText(parsed.reply) || asText(parsed.message)
          || (nodes.length ? `已规划 ${nodes.length} 个节点。` : '没有需要创建的节点。');
        return { plan: { reply, nodes }, structured: true };
      }
    } catch {
      // 回落到纯文本回复。
    }
  }
  return { plan: { reply: text || '模型没有返回内容。', nodes: [] }, structured: false };
};

/* ---------------- 生成参数 ---------------- */

export interface PromptReference {
  title: string;
  text: string;
}

/** 上游文本节点的内容作为参考放在提示词之前；自身提示词为空时只用参考内容。 */
export const composePrompt = (prompt: string, references: PromptReference[]) => {
  const own = (prompt || '').trim();
  const blocks = references
    .map((reference) => ({ title: reference.title.trim() || '参考文本', text: reference.text.trim() }))
    .filter((reference) => reference.text)
    .map((reference) => `【${reference.title}】\n${reference.text}`);
  if (!blocks.length) return own;
  return own ? `${blocks.join('\n\n')}\n\n${own}` : blocks.join('\n\n');
};

export const imageSizeForRatio = (ratio: string) =>
  ratio === '16:9' ? '1536x1024' : ratio === '9:16' ? '1024x1536' : '1024x1024';

/** 与视频工作台一致的分辨率映射。 */
export const videoResolutionForRatio = (ratio: string) => {
  if (ratio === '9:16') return '320x480';
  if (ratio === '4:7') return '360x480';
  if (ratio === '1:1' || ratio === '自适应') return '480x480';
  return '480x320';
};

export const ratioToCss = (ratio: unknown) => {
  const [w, h] = String(ratio || '1:1').split(':').map(Number);
  return w > 0 && h > 0 ? `${w} / ${h}` : '1 / 1';
};
