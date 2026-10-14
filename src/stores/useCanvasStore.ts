import { create } from 'zustand';
import { type Node, type Edge, type Viewport, addEdge, applyNodeChanges, applyEdgeChanges, type Connection, type NodeChange, type EdgeChange, type XYPosition } from '@xyflow/react';
import { useProjectStore } from './useProjectStore';
import {
  alignPositions,
  carryGeneratedOutputs,
  GROUP_Z_INDEX,
  groupBounds,
  isAnnotationKind,
  layoutLayers,
  normalizeRestoredCanvas,
  type AlignMode,
} from '../components/canvas/canvasModel';

interface CanvasSnapshot {
  nodes: Node[];
  edges: Edge[];
}

export interface CanvasClipboard {
  nodes: Node[];
  edges: Edge[];
}

interface UpdateNodeOptions {
  /** 记入撤销历史。默认不记录：提示词输入、生成状态等高频更新不应占满历史。 */
  history?: boolean;
}

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  undoStack: CanvasSnapshot[];
  redoStack: CanvasSnapshot[];
  selectedNodes: string[];
  viewport: Viewport;
  showMinimap: boolean;
  showGrid: boolean;
  zoomLevel: number;
  gridSize: number;

  // Actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNode: (id: string, data: Record<string, unknown>, options?: UpdateNodeOptions) => void;
  deleteNode: (id: string) => void;
  setViewport: (viewport: Viewport) => void;
  toggleMinimap: () => void;
  toggleGrid: () => void;
  setZoom: (level: number) => void;
  snapNodesToGrid: () => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  /** 在一次拖拽、缩放等连续操作开始前记录一次历史。 */
  commit: () => void;
  /** 批量加入节点与连线，并可选中新节点；只记一次历史。 */
  addNodes: (nodes: Node[], edges?: Edge[], options?: { select?: boolean }) => void;
  /** 删除节点及其连线；跳过已锁定的节点，返回实际删除的数量。 */
  removeNodes: (ids: string[]) => number;
  removeEdges: (ids: string[]) => void;
  /** 断开与这些节点相连的全部连线。 */
  disconnectNodes: (ids: string[]) => void;
  selectNodes: (ids: string[]) => void;
  /** 创建副本：复制节点、节点之间的连线，以及指向它们的上游连线。返回新节点 id。 */
  duplicateNodes: (ids: string[], offset?: XYPosition) => string[];
  pasteNodes: (clipboard: CanvasClipboard, at: XYPosition) => string[];
  /** 按连线依赖分列整理节点；不传 ids 时整理全部。便签、分组和锁定节点不参与。 */
  tidyNodes: (ids?: string[]) => void;
  /** 按选区外框对齐或均匀分布；锁定节点不动。 */
  alignNodes: (ids: string[], mode: AlignMode) => void;
  /** 锁定后不可拖动、不可删除，整理与对齐也不会移动它。 */
  setLocked: (ids: string[], locked: boolean) => void;
  /** 跟随移动（分组带动组内节点）。不记历史：拖拽开始时已记录一次。 */
  moveNodes: (positions: Record<string, XYPosition>) => void;
  /** 为这些节点建一个包住它们的分组框并选中它，返回分组 id。 */
  groupNodes: (ids: string[]) => string | null;

  // For undo/redo support
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  restoreSnapshot: (nodes: Node[], edges: Edge[]) => void;
  getSnapshot: () => { nodes: Node[]; edges: Edge[] };
}

const HISTORY_LIMIT = 60;
const STRUCTURAL_CHANGES = new Set(['add', 'remove', 'replace']);

const pushHistory = (state: CanvasState) => {
  const last = state.undoStack[state.undoStack.length - 1];
  // 状态没有变化时不重复记一步，避免撤销时“按了没反应”。
  if (last && last.nodes === state.nodes && last.edges === state.edges) return { undoStack: state.undoStack, redoStack: [] as CanvasSnapshot[] };
  return {
    undoStack: [...state.undoStack.slice(-(HISTORY_LIMIT - 1)), { nodes: state.nodes, edges: state.edges }],
    redoStack: [] as CanvasSnapshot[],
  };
};

/** 正在请求中的节点 id。撤销、切换画布页或重新载入时，以它为准恢复"生成中"状态。 */
export const runningGenerations = new Set<string>();

/** 本次会话里由放入文件创建、仍然有效的 blob 地址；恢复画布时其余 blob 地址视为失效。 */
export const liveObjectUrls = new Set<string>();

/** 撤销/重做时去掉选中态，并让"生成中"与真实在途请求一致。 */
const stripTransient = (nodes: Node[]) => nodes.map((node) => {
  const running = runningGenerations.has(node.id);
  if (!node.selected && Boolean(node.data?.isGenerating) === running) return node;
  return { ...node, selected: false, data: { ...node.data, isGenerating: running } };
});

const newId = () => crypto.randomUUID();

const cloneWithNewIds = (source: CanvasClipboard, offset: XYPosition, extraEdges: Edge[] = []) => {
  const idMap = new Map(source.nodes.map((node) => [node.id, newId()]));
  const nodes = source.nodes.map((node) => ({
    ...node,
    id: idMap.get(node.id) as string,
    position: { x: node.position.x + offset.x, y: node.position.y + offset.y },
    selected: true,
    dragging: false,
    draggable: undefined,
    deletable: undefined,
    data: { ...node.data, isGenerating: false, error: undefined, notice: undefined, stoppedAt: undefined, assetSaved: undefined, locked: undefined },
  }));
  const edges = [...source.edges, ...extraEdges].flatMap((edge) => {
    const sourceId = idMap.get(edge.source) ?? edge.source;
    const targetId = idMap.get(edge.target) ?? edge.target;
    if (sourceId === edge.source && targetId === edge.target) return [];
    return [{ ...edge, id: newId(), source: sourceId, target: targetId, selected: false }];
  });
  return { nodes, edges, ids: nodes.map((node) => node.id) };
};

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  undoStack: [],
  redoStack: [],
  edges: [],
  selectedNodes: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  showMinimap: false,
  showGrid: true,
  zoomLevel: 1,
  gridSize: 20,

  onNodesChange: (changes) => {
    set((state) => {
      const structural = changes.some((change) => STRUCTURAL_CHANGES.has(change.type));
      const nodes = applyNodeChanges(changes, state.nodes);
      const selectionChanged = changes.some((change) => change.type === 'select' || change.type === 'remove');
      return {
        ...(structural ? pushHistory(state) : {}),
        nodes,
        ...(selectionChanged ? { selectedNodes: nodes.filter((node) => node.selected).map((node) => node.id) } : {}),
      };
    });
  },
  onEdgesChange: (changes) => {
    set((state) => ({
      ...(changes.some((change) => STRUCTURAL_CHANGES.has(change.type)) ? pushHistory(state) : {}),
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },
  onConnect: (connection) => {
    if (connection.source === connection.target) return;
    set((state) => ({
      ...pushHistory(state),
      edges: addEdge({ ...connection, type: 'flow' }, state.edges),
    }));
  },
  addNode: (node) => {
    set((state) => ({
      ...pushHistory(state),
      nodes: [...state.nodes, node],
    }));
  },
  updateNode: (id, data, options) => {
    set((state) => ({
      ...(options?.history ? pushHistory(state) : {}),
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    }));
  },
  deleteNode: (id) => get().removeNodes([id]),
  setViewport: (viewport) => set({ viewport }),
  toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  setZoom: (level) => set({ zoomLevel: level }),
  snapNodesToGrid: () => {
    set((state) => ({
      ...pushHistory(state),
      nodes: state.nodes.map((node) => ({
        ...node,
        position: {
          x: Math.round(node.position.x / state.gridSize) * state.gridSize,
          y: Math.round(node.position.y / state.gridSize) * state.gridSize,
        },
      })),
    }));
  },
  clearCanvas: () => {
    set((state) => ({
      ...pushHistory(state),
      nodes: [],
      edges: [],
      selectedNodes: [],
    }));
  },
  undo: () => {
    set((state) => {
      const previous = state.undoStack[state.undoStack.length - 1];
      if (!previous) return state;
      return {
        nodes: carryGeneratedOutputs(stripTransient(previous.nodes), state.nodes),
        edges: previous.edges,
        selectedNodes: [],
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, { nodes: state.nodes, edges: state.edges }],
      };
    });
  },
  redo: () => {
    set((state) => {
      const next = state.redoStack[state.redoStack.length - 1];
      if (!next) return state;
      return {
        nodes: carryGeneratedOutputs(stripTransient(next.nodes), state.nodes),
        edges: next.edges,
        selectedNodes: [],
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, { nodes: state.nodes, edges: state.edges }],
      };
    });
  },
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  commit: () => set((state) => pushHistory(state)),
  addNodes: (nodes, edges = [], options) => {
    if (!nodes.length && !edges.length) return;
    set((state) => {
      const select = options?.select ?? true;
      const existing = select ? state.nodes.map((node) => (node.selected ? { ...node, selected: false } : node)) : state.nodes;
      const added = nodes.map((node) => ({ ...node, selected: select }));
      return {
        ...pushHistory(state),
        nodes: [...existing, ...added],
        edges: edges.reduce((current, edge) => addEdge({ type: 'flow', ...edge }, current), state.edges),
        ...(select ? { selectedNodes: added.map((node) => node.id) } : {}),
      };
    });
  },
  removeNodes: (ids) => {
    const requested = new Set(ids);
    // 锁定的节点不随任何入口删除；返回实际删除的数量，便于入口提示跳过了几个。
    const removing = new Set(get().nodes.filter((node) => requested.has(node.id) && !node.data?.locked).map((node) => node.id));
    if (!removing.size) return 0;
    set((state) => ({
      ...pushHistory(state),
      nodes: state.nodes.filter((node) => !removing.has(node.id)),
      edges: state.edges.filter((edge) => !removing.has(edge.source) && !removing.has(edge.target)),
      selectedNodes: state.selectedNodes.filter((id) => !removing.has(id)),
    }));
    return removing.size;
  },
  removeEdges: (ids) => {
    if (!ids.length) return;
    const removing = new Set(ids);
    set((state) => ({ ...pushHistory(state), edges: state.edges.filter((edge) => !removing.has(edge.id)) }));
  },
  disconnectNodes: (ids) => {
    const targets = new Set(ids);
    const remaining = get().edges.filter((edge) => !targets.has(edge.source) && !targets.has(edge.target));
    if (remaining.length === get().edges.length) return;
    set((state) => ({ ...pushHistory(state), edges: remaining }));
  },
  selectNodes: (ids) => {
    const selected = new Set(ids);
    set((state) => ({
      nodes: state.nodes.map((node) => (Boolean(node.selected) === selected.has(node.id) ? node : { ...node, selected: selected.has(node.id) })),
      edges: state.edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)),
      selectedNodes: ids,
    }));
  },
  duplicateNodes: (ids, offset = { x: 48, y: 48 }) => {
    const picked = new Set(ids);
    const { nodes, edges } = get();
    const source = {
      nodes: nodes.filter((node) => picked.has(node.id)),
      edges: edges.filter((edge) => picked.has(edge.source) && picked.has(edge.target)),
    };
    if (!source.nodes.length) return [];
    const upstream = edges.filter((edge) => !picked.has(edge.source) && picked.has(edge.target));
    const clone = cloneWithNewIds(source, offset, upstream);
    get().addNodes(clone.nodes, clone.edges);
    return clone.ids;
  },
  pasteNodes: (clipboard, at) => {
    if (!clipboard.nodes.length) return [];
    const minX = Math.min(...clipboard.nodes.map((node) => node.position.x));
    const minY = Math.min(...clipboard.nodes.map((node) => node.position.y));
    const clone = cloneWithNewIds(clipboard, { x: at.x - minX, y: at.y - minY });
    get().addNodes(clone.nodes, clone.edges);
    return clone.ids;
  },
  tidyNodes: (ids) => {
    const { nodes, edges } = get();
    const scope = ids?.length ? new Set(ids) : new Set(nodes.map((node) => node.id));
    const items = nodes.filter((node) => scope.has(node.id) && !isAnnotationKind(node.type) && !node.data?.locked).map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: node.measured?.width ?? node.width ?? 320,
      height: node.measured?.height ?? node.height ?? 240,
    }));
    if (items.length < 2) return;
    const positions = layoutLayers(items, edges.filter((edge) => scope.has(edge.source) && scope.has(edge.target)));
    set((state) => ({
      ...pushHistory(state),
      nodes: state.nodes.map((node) => (positions[node.id] ? { ...node, position: positions[node.id] } : node)),
    }));
  },
  alignNodes: (ids, mode) => {
    const picked = new Set(ids);
    const items = get().nodes.filter((node) => picked.has(node.id) && !node.data?.locked).map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: node.measured?.width ?? node.width ?? 320,
      height: node.measured?.height ?? node.height ?? 240,
    }));
    const positions = alignPositions(items, mode);
    const moved = Object.entries(positions).filter(([id, position]) => {
      const item = items.find((entry) => entry.id === id);
      return item && (item.x !== position.x || item.y !== position.y);
    });
    if (!moved.length) return;
    set((state) => ({
      ...pushHistory(state),
      nodes: state.nodes.map((node) => (positions[node.id] ? { ...node, position: positions[node.id] } : node)),
    }));
  },
  setLocked: (ids, locked) => {
    const picked = new Set(ids);
    set((state) => ({
      ...pushHistory(state),
      nodes: state.nodes.map((node) => (picked.has(node.id)
        ? { ...node, draggable: locked ? false : undefined, deletable: locked ? false : undefined, data: { ...node.data, locked: locked || undefined } }
        : node)),
    }));
  },
  moveNodes: (positions) => {
    set((state) => ({
      nodes: state.nodes.map((node) => (positions[node.id] ? { ...node, position: positions[node.id] } : node)),
    }));
  },
  groupNodes: (ids) => {
    const picked = new Set(ids);
    const items = get().nodes.filter((node) => picked.has(node.id) && node.type !== 'group').map((node) => ({
      x: node.position.x,
      y: node.position.y,
      width: node.measured?.width ?? node.width ?? 320,
      height: node.measured?.height ?? node.height ?? 240,
    }));
    if (!items.length) return null;
    const box = groupBounds(items);
    const id = newId();
    get().addNodes([{
      id,
      type: 'group',
      position: { x: box.x, y: box.y },
      width: box.width,
      height: box.height,
      zIndex: GROUP_Z_INDEX,
      data: { title: '' },
    }]);
    return id;
  },

  // For undo/redo support
  setNodes: (nodes) => set((state) => ({
    ...pushHistory(state),
    nodes,
  })),
  setEdges: (edges) => set((state) => ({
    ...pushHistory(state),
    edges,
  })),
  restoreSnapshot: (nodes, edges) => {
    const restored = normalizeRestoredCanvas({ nodes, edges }, (id) => runningGenerations.has(id), (url) => liveObjectUrls.has(url));
    set({
      nodes: restored.nodes as Node[],
      edges: restored.edges as Edge[],
      selectedNodes: [],
      undoStack: [],
      redoStack: [],
    });
  },
  getSnapshot: () => ({ nodes: get().nodes, edges: get().edges }),
}));

let projectSaveTimer: number | undefined;
useCanvasStore.subscribe((state, previousState) => {
  if (state.nodes === previousState.nodes && state.edges === previousState.edges) return;
  const projectId = useProjectStore.getState().activeProjectId;
  if (!projectId) return;
  window.clearTimeout(projectSaveTimer);
  const canvas = { nodes: state.nodes, edges: state.edges };
  projectSaveTimer = window.setTimeout(() => {
    useProjectStore.getState().saveProjectCanvas(projectId, canvas);
  }, 240);
});
