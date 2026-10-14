import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type Node,
  type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './canvas.css';
import { AiGenerate, Artboard, Clipboard, Copy, Focus, Layers, LayoutMasonry, Lock, SelectAll, StopFill, Trash2, Unlink, Unlock, Upload } from '@/lib/remixIconShim';
import { workspaceCacheService } from '../../services/workspaceCacheService';
import { liveObjectUrls, useCanvasStore, type CanvasClipboard } from '../../stores/useCanvasStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { AnimatePresence, MotionConfig } from '../motion';
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, TooltipProvider } from '../ui';
import { GroupNode } from '../nodes/GroupNode';
import { ImageGenNode } from '../nodes/ImageGenNode';
import { NoteNode } from '../nodes/NoteNode';
import { TextNode } from '../nodes/TextNode';
import { VideoNode } from '../nodes/VideoNode';
import { AGENT_PANEL_WIDTH, CanvasAgentPanel } from './CanvasAgentPanel';
import { AnchoredMenu, NodePicker, type ScreenPoint } from './CanvasContextMenu';
import { CanvasControls, FIT_OPTIONS } from './CanvasControls';
import { CanvasHeader, CanvasTopActions } from './CanvasHeader';
import {
  ALIGN_ACTIONS,
  CanvasEmptyState,
  CanvasToast,
  DropOverlay,
  MediaLightbox,
  SelectionToolbar,
  ShortcutsDialog,
  isDistributeMode,
  type CanvasToastState,
} from './CanvasOverlays';
import { CanvasRail, type CanvasTool } from './CanvasToolbar';
import { CanvasActionsContext, type CanvasActions, type PickerConnect } from './canvasContext';
import {
  ANNOTATION_LABEL,
  groupMemberIds,
  isAnnotationKind,
  isCanvasNodeKind,
  layoutLayers,
  nextBoardName,
  resolveProjectBoards,
  type AgentPlan,
  type AlignMode,
  type CanvasAnnotationKind,
  type CanvasNodeKind,
  type CanvasWorkspaceCache,
  type ProjectBoards,
  type StoredChatMessage,
} from './canvasModel';
import { FlowEdge } from './FlowEdge';
import { describeRunSummary, isNodeRunnable, runNodeGeneration, runNodesInOrder, stopNodeGenerations } from './generation';
import { ANNOTATION_CATALOG_LIST, NODE_CATALOG, NODE_CATALOG_LIST, makeAnnotationNode, makeCanvasNode } from './nodeCatalog';

const nodeTypes = { text: TextNode, imageGen: ImageGenNode, video: VideoNode, note: NoteNode, group: GroupNode };
const edgeTypes = { flow: FlowEdge };
const defaultEdgeOptions = { type: 'flow' };
const SNAP_GRID: [number, number] = [20, 20];
const CLIPBOARD_MARKER = 'lizuo-canvas/v1:';
const MESSAGE_LIMIT = 120;
const CACHE_KEY = 'canvas-workspace';

type PickerState = { screen: ScreenPoint; flow: XYPosition; connect?: PickerConnect; atPoint: boolean };
type MenuState = { screen: ScreenPoint; flow: XYPosition; kind: 'pane' | 'node' | 'selection'; nodeId?: string };
type MediaState = { kind: 'image' | 'video'; url: string; title: string };

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"], [role="listbox"], .nokey'));

const nodeSize = (node: Node) => {
  const width = node.measured?.width ?? node.width ?? 320;
  const [w, h] = String(node.data?.aspectRatio || '1:1').split(':').map(Number);
  const height = node.measured?.height ?? node.height ?? Math.round(width * ((h || 1) / (w || 1)));
  return { width, height };
};

const edgeId = (source: string, target: string) => `xy-edge__${source}-${target}`;

/** 从期望位置开始，沿竖直方向交替向下、向上寻找不与已有节点重叠的位置。 */
const findFreeSlot = (desired: XYPosition, size: { width: number; height: number }, nodes: Node[], gap = 48) => {
  const overlaps = (y: number) => nodes.some((other) => {
    const box = nodeSize(other);
    return desired.x < other.position.x + box.width + gap && desired.x + size.width + gap > other.position.x
      && y < other.position.y + box.height + gap && y + size.height + gap > other.position.y;
  });
  const step = size.height + gap;
  for (let index = 0; index < 24; index += 1) {
    const offset = Math.ceil(index / 2) * step * (index % 2 ? 1 : -1);
    if (!overlaps(desired.y + offset)) return { x: desired.x, y: desired.y + offset };
  }
  return desired;
};

/** 新节点与已有节点几乎重合时斜向错开，避免叠在一起看不出。 */
const nudgeFromOverlap = (node: Node, taken: Node[]) => {
  for (let guard = 0; guard < 12; guard += 1) {
    const overlapping = taken.some((other) => Math.abs(other.position.x - node.position.x) < 24 && Math.abs(other.position.y - node.position.y) < 24);
    if (!overlapping) break;
    node.position = { x: node.position.x + 32, y: node.position.y + 32 };
  }
  return node;
};

/** 放入文件得到的 blob 地址只在本次会话有效；登记后，恢复画布时才能区分仍有效与已失效的地址。 */
const sessionObjectUrl = (file: File) => {
  const url = URL.createObjectURL(file);
  liveObjectUrls.add(url);
  return url;
};

type GroupFollower = { group: string; origin: XYPosition; start: XYPosition };

const CanvasInner = ({ onBack }: { onBack?: () => void }) => {
  const flow = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pointerRef = useRef<ScreenPoint | null>(null);
  const clipboardRef = useRef<CanvasClipboard | null>(null);
  const uploadTargetRef = useRef<XYPosition | null>(null);

  const [tool, setTool] = useState<CanvasTool>('select');
  const [spacePan, setSpacePan] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [media, setMedia] = useState<MediaState | null>(null);
  const [toast, setToast] = useState<CanvasToastState | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const selectedIds = useCanvasStore((state) => state.selectedNodes);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const commit = useCanvasStore((state) => state.commit);
  const addNodes = useCanvasStore((state) => state.addNodes);
  const removeNodes = useCanvasStore((state) => state.removeNodes);
  const selectNodes = useCanvasStore((state) => state.selectNodes);
  const duplicateNodes = useCanvasStore((state) => state.duplicateNodes);
  const disconnectNodes = useCanvasStore((state) => state.disconnectNodes);
  const alignNodes = useCanvasStore((state) => state.alignNodes);
  const setLocked = useCanvasStore((state) => state.setLocked);
  const moveNodes = useCanvasStore((state) => state.moveNodes);
  const groupNodes = useCanvasStore((state) => state.groupNodes);
  const pasteNodes = useCanvasStore((state) => state.pasteNodes);
  const tidyNodes = useCanvasStore((state) => state.tidyNodes);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const restoreSnapshot = useCanvasStore((state) => state.restoreSnapshot);
  const setZoom = useCanvasStore((state) => state.setZoom);
  const projectId = useProjectStore((state) => state.activeProjectId);

  /* ---------- 提示条 ---------- */

  const toastTimer = useRef<number>();
  const notify = useCallback((message: string, action?: CanvasToastState['action']) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, action });
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 5200 : 2400);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* ---------- 坐标 ---------- */

  const visibleCenter = useCallback((): XYPosition => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const usableWidth = rect.width - (agentOpen ? AGENT_PANEL_WIDTH + 24 : 0);
    return flow.screenToFlowPosition({ x: rect.left + usableWidth / 2, y: rect.top + rect.height / 2 });
  }, [agentOpen, flow]);

  /** 鼠标在画布内时用鼠标位置，否则用可见区域中心。 */
  const insertionPoint = useCallback((): XYPosition => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const pointer = pointerRef.current;
    if (rect && pointer && pointer.x > rect.left && pointer.x < rect.right && pointer.y > rect.top && pointer.y < rect.bottom) {
      return flow.screenToFlowPosition(pointer);
    }
    return visibleCenter();
  }, [flow, visibleCenter]);

  const focusNodes = useCallback((ids: string[], select = true) => {
    if (!ids.length) return;
    if (select) selectNodes(ids);
    window.setTimeout(() => void flow.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.32, maxZoom: 1, duration: 320 }), 40);
  }, [flow, selectNodes]);

  /* ---------- 新建节点 ---------- */

  /** 在指定点（节点中心）放一个新节点；与已有节点重叠时错开。 */
  const addNodeAt = useCallback((kind: CanvasNodeKind, point: XYPosition, data: Record<string, unknown> = {}) => {
    const node = nudgeFromOverlap(makeCanvasNode(kind, point, data, { centered: true }), useCanvasStore.getState().nodes);
    addNodes([node]);
    return node;
  }, [addNodes]);

  /** 便签与分组只是批注：不参与生成，也不接受连线。 */
  const addAnnotationAt = useCallback((kind: CanvasAnnotationKind, point: XYPosition) => {
    const node = nudgeFromOverlap(makeAnnotationNode(kind, point), useCanvasStore.getState().nodes);
    addNodes([node]);
    return node;
  }, [addNodes]);

  const addFromShortcut = useCallback((kind: CanvasNodeKind) => addNodeAt(kind, insertionPoint()), [addNodeAt, insertionPoint]);

  const openPicker = useCallback<CanvasActions['openPicker']>((screen, options = {}) => {
    setMenu(null);
    setPicker({
      screen,
      flow: options.flowPosition ?? flow.screenToFlowPosition(screen),
      connect: options.connect,
      atPoint: Boolean(options.flowPosition) || !options.connect,
    });
  }, [flow]);

  const createFromPicker = useCallback((kind: CanvasNodeKind) => {
    if (!picker) return;
    const { connect, flow: point, atPoint } = picker;
    if (!connect) {
      addNodeAt(kind, point);
      return;
    }
    const anchor = useCanvasStore.getState().nodes.find((node) => node.id === connect.nodeId);
    if (!anchor) return;
    const node = makeCanvasNode(kind, { x: 0, y: 0 });
    const size = nodeSize(node);
    const anchorSize = nodeSize(anchor);
    const downstream = connect.side === 'source';
    const position = atPoint
      ? { x: downstream ? point.x : point.x - size.width, y: point.y - size.height / 2 }
      : {
          x: downstream ? anchor.position.x + anchorSize.width + 120 : anchor.position.x - 120 - size.width,
          y: anchor.position.y + anchorSize.height / 2 - size.height / 2,
        };
    const slot = atPoint ? position : findFreeSlot(position, size, useCanvasStore.getState().nodes);
    node.position = { x: Math.round(slot.x), y: Math.round(slot.y) };
    const [source, target] = downstream ? [anchor.id, node.id] : [node.id, anchor.id];
    addNodes([node], [{ id: edgeId(source, target), source, target, type: 'flow' }]);
  }, [addNodeAt, addNodes, picker]);

  const createAnnotationFromPicker = useCallback((kind: CanvasAnnotationKind) => {
    if (picker && !picker.connect) addAnnotationAt(kind, picker.flow);
  }, [addAnnotationAt, picker]);

  /* ---------- 上传与粘贴 ---------- */

  const importFiles = useCallback(async (files: File[], at: XYPosition) => {
    const created: Node[] = [];
    let skipped = 0;
    for (const [index, file] of files.entries()) {
      const point = { x: at.x + index * 40, y: at.y + index * 40 };
      if (file.type.startsWith('image/')) {
        created.push(makeCanvasNode('imageGen', point, { title: file.name, imageUrl: sessionObjectUrl(file), source: 'upload' }, { centered: true }));
      } else if (file.type.startsWith('video/')) {
        created.push(makeCanvasNode('video', point, { title: file.name, previewUrl: sessionObjectUrl(file), source: 'upload' }, { centered: true }));
      } else if (/\.(txt|md)$/i.test(file.name) || file.type.startsWith('text/')) {
        created.push(makeCanvasNode('text', point, { title: file.name, content: await file.text() }, { centered: true }));
      } else {
        skipped += 1;
      }
    }
    if (created.length) addNodes(created);
    if (skipped) notify(`有 ${skipped} 个文件类型不支持，只能放入图片、视频或文本`);
    else if (created.length) notify(`已放入 ${created.length} 个素材`);
  }, [addNodes, notify]);

  const openUpload = useCallback((at?: XYPosition) => {
    uploadTargetRef.current = at ?? null;
    fileInputRef.current?.click();
  }, []);

  const copySelection = useCallback((cut = false) => {
    const { nodes: all, edges: allEdges, selectedNodes } = useCanvasStore.getState();
    const picked = new Set(selectedNodes);
    if (!picked.size) return;
    const clip: CanvasClipboard = {
      nodes: all.filter((node) => picked.has(node.id)),
      edges: allEdges.filter((edge) => picked.has(edge.source) && picked.has(edge.target)),
    };
    clipboardRef.current = clip;
    void navigator.clipboard?.writeText(CLIPBOARD_MARKER + JSON.stringify(clip)).catch(() => undefined);
    if (cut) {
      const removed = removeNodes([...picked]);
      const skipped = picked.size - removed;
      if (!removed) notify('所选节点都已锁定，只复制、未剪切');
      else notify(skipped ? `已剪切 ${removed} 个节点，${skipped} 个锁定节点只复制` : `已剪切 ${removed} 个节点`);
    } else {
      notify(`已复制 ${picked.size} 个节点`);
    }
  }, [notify, removeNodes]);

  const pasteClipboard = useCallback((clip: CanvasClipboard | null, at: XYPosition) => {
    if (!clip?.nodes.length) return;
    const ids = pasteNodes(clip, at);
    if (ids.length) notify(`已粘贴 ${ids.length} 个节点`);
  }, [notify, pasteNodes]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target) || !event.clipboardData) return;
      const files = [...event.clipboardData.files];
      if (files.length) {
        event.preventDefault();
        void importFiles(files, insertionPoint());
        return;
      }
      const text = event.clipboardData.getData('text/plain');
      if (text.startsWith(CLIPBOARD_MARKER)) {
        event.preventDefault();
        try {
          const clip = JSON.parse(text.slice(CLIPBOARD_MARKER.length)) as CanvasClipboard;
          if (Array.isArray(clip.nodes) && Array.isArray(clip.edges)) pasteClipboard(clip, insertionPoint());
        } catch {
          notify('剪贴板内容已损坏，无法粘贴');
        }
        return;
      }
      if (text.trim()) {
        event.preventDefault();
        addNodeAt('text', insertionPoint(), { content: text });
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addNodeAt, importFiles, insertionPoint, notify, pasteClipboard]);

  /* ---------- 节点操作 ---------- */

  const runSelected = useCallback((ids = useCanvasStore.getState().selectedNodes) => {
    const { nodes: all, edges: allEdges } = useCanvasStore.getState();
    const picked = all.filter((node) => ids.includes(node.id));
    if (!picked.length) {
      notify('先选择要生成的节点');
      return;
    }
    const runnable = picked.filter((node) => isNodeRunnable(node, all, allEdges)).map((node) => node.id);
    if (!runnable.length) {
      notify(picked.every((node) => isAnnotationKind(node.type)) ? '便签和分组不参与生成' : '所选节点还没有提示词，或正在生成');
      return;
    }
    if (runnable.length === 1) {
      void runNodeGeneration(runnable[0]);
      return;
    }
    notify(`开始运行 ${runnable.length} 个节点`);
    void runNodesInOrder(runnable).then((summary) => notify(describeRunSummary(summary)));
  }, [notify]);

  const deleteWithUndo = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const removed = removeNodes(ids);
    if (!removed) {
      notify('所选节点都已锁定，解锁后才能删除');
      return;
    }
    const skipped = ids.length - removed;
    notify(skipped ? `已删除 ${removed} 个节点，跳过 ${skipped} 个锁定节点` : `已删除 ${removed} 个节点`, { label: '撤销', run: undo });
  }, [notify, removeNodes, undo]);

  /** 键盘删除走 xyflow 自带流程，锁定节点已被过滤掉；这里补上与菜单删除一致的提示。 */
  const handleBeforeDelete = useCallback(async ({ nodes: removing }: { nodes: Node[]; edges: Edge[] }) => {
    const { nodes: all, selectedNodes } = useCanvasStore.getState();
    const removingIds = new Set(removing.map((node) => node.id));
    const skipped = all.filter((node) => selectedNodes.includes(node.id) && node.data?.locked && !removingIds.has(node.id)).length;
    if (skipped && !removing.length) notify('所选节点都已锁定，解锁后才能删除');
    else if (removing.length) notify(skipped ? `已删除 ${removing.length} 个节点，跳过 ${skipped} 个锁定节点` : `已删除 ${removing.length} 个节点`, { label: '撤销', run: undo });
    return true;
  }, [notify, undo]);

  const tidy = useCallback((ids?: string[]) => {
    const scope = ids?.length ? ids : undefined;
    // 便签和分组不参与整理，只按可生成的节点计数。
    const pool = useCanvasStore.getState().nodes.filter((node) => isCanvasNodeKind(node.type) && (!scope || scope.includes(node.id)));
    if (pool.length < 2) {
      notify('至少需要两个节点才能整理');
      return;
    }
    tidyNodes(scope);
    window.setTimeout(() => void flow.fitView({ ...FIT_OPTIONS, nodes: scope?.map((id) => ({ id })) }), 40);
    notify('已按连线整理布局', { label: '撤销', run: undo });
  }, [flow, notify, tidyNodes, undo]);

  const groupSelection = useCallback((ids = useCanvasStore.getState().selectedNodes) => {
    const picked = new Set(ids);
    const members = useCanvasStore.getState().nodes.filter((node) => picked.has(node.id) && node.type !== 'group');
    if (!members.length) {
      notify('先选择要编组的节点');
      return;
    }
    if (groupNodes(members.map((node) => node.id))) notify(`已编组 ${members.length} 个节点`, { label: '撤销', run: undo });
  }, [groupNodes, notify, undo]);

  /** 解散分组只删画框，组内节点留在原处。 */
  const ungroupSelection = useCallback((ids = useCanvasStore.getState().selectedNodes) => {
    const picked = new Set(ids);
    const groups = useCanvasStore.getState().nodes.filter((node) => picked.has(node.id) && node.type === 'group');
    if (!groups.length) return;
    const removed = removeNodes(groups.map((node) => node.id));
    if (!removed) notify('所选分组已锁定，解锁后才能解散');
    else notify(`已解散 ${removed} 个分组，组内节点保留`, { label: '撤销', run: undo });
  }, [notify, removeNodes, undo]);

  const toggleLockSelection = useCallback((ids = useCanvasStore.getState().selectedNodes) => {
    const picked = new Set(ids);
    const targets = useCanvasStore.getState().nodes.filter((node) => picked.has(node.id));
    if (!targets.length) return;
    const lock = !targets.every((node) => node.data?.locked);
    setLocked(targets.map((node) => node.id), lock);
    notify(lock ? `已锁定 ${targets.length} 个节点：不可拖动、缩放或删除` : `已解锁 ${targets.length} 个节点`);
  }, [notify, setLocked]);

  const alignSelection = useCallback((mode: AlignMode, ids = useCanvasStore.getState().selectedNodes) => {
    const picked = new Set(ids);
    const movable = useCanvasStore.getState().nodes.filter((node) => picked.has(node.id) && !node.data?.locked).map((node) => node.id);
    const distribute = isDistributeMode(mode);
    if (movable.length < (distribute ? 3 : 2)) {
      notify(distribute ? '均分至少需要 3 个未锁定的节点' : '对齐至少需要 2 个未锁定的节点');
      return;
    }
    alignNodes(movable, mode);
  }, [alignNodes, notify]);

  const stopSelection = useCallback((ids = useCanvasStore.getState().selectedNodes) => {
    const stopped = stopNodeGenerations(ids);
    if (stopped) notify(`已在本地停止 ${stopped} 个生成；供应商侧可能仍会完成并计费`);
  }, [notify]);

  /** 侧栏的分组按钮：有选区时编组所选，否则在视野中心新建空画框。 */
  const addAnnotation = useCallback((kind: CanvasAnnotationKind) => {
    const { nodes: all, selectedNodes } = useCanvasStore.getState();
    const picked = new Set(selectedNodes);
    if (kind === 'group' && all.some((node) => picked.has(node.id) && node.type !== 'group')) {
      groupSelection(selectedNodes);
      return;
    }
    addAnnotationAt(kind, visibleCenter());
  }, [addAnnotationAt, groupSelection, visibleCenter]);

  const selectionStats = useMemo(() => {
    const picked = new Set(selectedIds);
    const selection = nodes.filter((node) => picked.has(node.id));
    return {
      runnable: selection.filter((node) => isNodeRunnable(node, nodes, edges)).length,
      generating: selection.filter((node) => node.data?.isGenerating).length,
      allLocked: selection.length > 0 && selection.every((node) => node.data?.locked),
    };
  }, [edges, nodes, selectedIds]);

  /* ---------- 连线 ---------- */

  const isValidConnection = useCallback((connection: Edge | Connection) => {
    const { source, target } = connection;
    if (!source || !target || source === target) return false;
    const { nodes: allNodes, edges: allEdges } = useCanvasStore.getState();
    // 便签与分组不参与生成，也不接受连线。
    if (allNodes.some((node) => (node.id === source || node.id === target) && isAnnotationKind(node.type))) return false;
    if (allEdges.some((edge) => edge.source === source && edge.target === target)) return false;
    const downstream = new Map<string, string[]>();
    allEdges.forEach((edge) => downstream.set(edge.source, [...(downstream.get(edge.source) || []), edge.target]));
    const stack = [target];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop() as string;
      if (id === source) return false;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(downstream.get(id) || []));
    }
    return true;
  }, []);

  const handleConnectEnd = useCallback((event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
    setConnecting(false);
    if (state.isValid || !state.fromNode || !state.fromHandle) return;
    const point = 'changedTouches' in event ? event.changedTouches[0] : event;
    if (!point) return;
    const fromId = state.fromNode.id;
    const side = state.fromHandle.type;
    const hit = document.elementFromPoint(point.clientX, point.clientY);
    const otherId = hit?.closest('.react-flow__node')?.getAttribute('data-id');
    const other = otherId ? useCanvasStore.getState().nodes.find((node) => node.id === otherId) : undefined;
    // 松开在便签或分组上，与松开在空白处一样：在该点新建节点。
    if (other && !isAnnotationKind(other.type)) {
      if (other.id === fromId) return;
      const connection: Connection = side === 'source'
        ? { source: fromId, target: other.id, sourceHandle: null, targetHandle: null }
        : { source: other.id, target: fromId, sourceHandle: null, targetHandle: null };
      if (isValidConnection(connection)) onConnect(connection);
      else notify('无法连接：会形成循环或重复连线');
      return;
    }
    if (!other && !hit?.closest('.react-flow__pane')) return;
    const screen = { x: point.clientX, y: point.clientY };
    openPicker(screen, { connect: { nodeId: fromId, side }, flowPosition: flow.screenToFlowPosition(screen) });
  }, [flow, isValidConnection, notify, onConnect, openPicker]);

  /* ---------- 分组拖动 ---------- */

  // 分组按位置收纳节点（不用 parentId）：拖动开始时记下组内节点的起点，拖动中按分组的位移带着它们走。
  const followersRef = useRef<Map<string, GroupFollower>>(new Map());

  const beginDrag = useCallback((dragged: Node[]) => {
    commit();
    const all = useCanvasStore.getState().nodes;
    const moving = new Set(dragged.map((node) => node.id));
    const followers = new Map<string, GroupFollower>();
    dragged.filter((node) => node.type === 'group').forEach((group) => {
      groupMemberIds(group, all).forEach((id) => {
        const member = all.find((node) => node.id === id);
        if (!member || moving.has(id) || member.data?.locked || followers.has(id)) return;
        followers.set(id, { group: group.id, origin: group.position, start: member.position });
      });
    });
    followersRef.current = followers;
  }, [commit]);

  const followDrag = useCallback((dragged: Node[]) => {
    if (!followersRef.current.size) return;
    const groups = new Map(dragged.map((node) => [node.id, node.position]));
    const positions: Record<string, XYPosition> = {};
    followersRef.current.forEach((entry, id) => {
      const at = groups.get(entry.group);
      if (at) positions[id] = { x: entry.start.x + at.x - entry.origin.x, y: entry.start.y + at.y - entry.origin.y };
    });
    moveNodes(positions);
  }, [moveNodes]);

  const endDrag = useCallback((dragged: Node[]) => {
    followDrag(dragged);
    followersRef.current = new Map();
  }, [followDrag]);

  /* ---------- 画布页（按项目保存） ---------- */

  const [boardState, setBoardState] = useState<ProjectBoards | null>(null);
  // 画布页状态同时保存在 ref 中：切换画布页要读写画布 store，这类副作用不能放进 setState 的 updater
  //（StrictMode 会重复调用 updater，第二次会把新画布页的内容写进旧画布页）。
  const boardRef = useRef<ProjectBoards | null>(null);
  const commitBoards = useCallback((next: ProjectBoards | null) => {
    boardRef.current = next;
    setBoardState(next);
  }, []);
  const cacheRef = useRef<CanvasWorkspaceCache>({ version: 2, projects: {} });
  const loadedProjectRef = useRef<string | null>(null);
  const writableRef = useRef(false);
  const pendingWriteRef = useRef<CanvasWorkspaceCache | null>(null);
  const writeTimerRef = useRef<number>();

  const flushWrite = useCallback(() => {
    window.clearTimeout(writeTimerRef.current);
    const payload = pendingWriteRef.current;
    pendingWriteRef.current = null;
    if (payload) void workspaceCacheService.write(CACHE_KEY, payload).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!projectId) return undefined;
    let cancelled = false;
    loadedProjectRef.current = null;
    commitBoards(null);
    void workspaceCacheService.read<unknown>(CACHE_KEY).then(
      (raw) => ({ raw, ok: true }),
      () => ({ raw: null, ok: false }),
    ).then(({ raw, ok }) => {
      if (cancelled) return;
      const live = useCanvasStore.getState();
      const saved = useProjectStore.getState().projects.find((project) => project.id === projectId)?.canvas;
      // 画布 store 为空、项目里却存着内容时（例如开发热更新重建了 store），以项目保存的内容为准，避免把空画布写回画布页。
      const useSaved = !live.nodes.length && Boolean(saved?.nodes?.length);
      if (useSaved && saved) restoreSnapshot(saved.nodes as Node[], (saved.edges || []) as Edge[]);
      const current = useSaved && saved ? { nodes: saved.nodes, edges: saved.edges || [] } : { nodes: live.nodes, edges: live.edges };
      const resolved = resolveProjectBoards(raw, projectId, current);
      cacheRef.current = resolved.cache;
      // 读取失败时不回写，避免用空缓存覆盖其他项目的画布页。
      writableRef.current = ok;
      loadedProjectRef.current = projectId;
      commitBoards(resolved.boards);
    });
    return () => {
      cancelled = true;
      flushWrite();
    };
  }, [commitBoards, flushWrite, projectId, restoreSnapshot]);

  useEffect(() => {
    if (!boardState || !projectId || loadedProjectRef.current !== projectId || !writableRef.current) return;
    const payload: CanvasWorkspaceCache = {
      ...cacheRef.current,
      projects: {
        ...cacheRef.current.projects,
        [projectId]: { ...boardState, snapshots: { ...boardState.snapshots, [boardState.activeBoard]: { nodes, edges } } },
      },
    };
    cacheRef.current = payload;
    pendingWriteRef.current = payload;
    window.clearTimeout(writeTimerRef.current);
    writeTimerRef.current = window.setTimeout(flushWrite, 400);
  }, [boardState, edges, flushWrite, nodes, projectId]);

  const activeBoard = boardState?.activeBoard || '画布 1';
  const boards = boardState?.boards || [activeBoard];
  const messages = boardState?.messages[activeBoard] || [];

  const switchBoard = useCallback((board: string) => {
    const current = boardRef.current;
    if (!current || board === current.activeBoard || !current.boards.includes(board)) return;
    const { nodes: liveNodes, edges: liveEdges } = useCanvasStore.getState();
    const snapshots = { ...current.snapshots, [current.activeBoard]: { nodes: liveNodes, edges: liveEdges } };
    const next = snapshots[board] || { nodes: [], edges: [] };
    commitBoards({ ...current, activeBoard: board, snapshots });
    restoreSnapshot(next.nodes as Node[], next.edges as Edge[]);
    setPicker(null);
    setMenu(null);
    window.setTimeout(() => void flow.fitView(FIT_OPTIONS), 60);
  }, [commitBoards, flow, restoreSnapshot]);

  const createBoard = useCallback(() => {
    const current = boardRef.current;
    if (!current) return;
    const name = nextBoardName(current.boards);
    commitBoards({
      ...current,
      boards: [...current.boards, name],
      snapshots: { ...current.snapshots, [name]: { nodes: [], edges: [] } },
      messages: { ...current.messages, [name]: [] },
    });
    switchBoard(name);
  }, [commitBoards, switchBoard]);

  const renameBoard = useCallback((from: string, to: string) => {
    const current = boardRef.current;
    const name = to.trim();
    if (!current || !name || name === from) return;
    if (current.boards.includes(name)) {
      notify(`已存在名为「${name}」的画布页`);
      return;
    }
    const rename = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key === from ? name : key, value]));
    commitBoards({
      boards: current.boards.map((board) => (board === from ? name : board)),
      activeBoard: current.activeBoard === from ? name : current.activeBoard,
      snapshots: rename(current.snapshots),
      messages: rename(current.messages),
    });
  }, [commitBoards, notify]);

  const deleteBoard = useCallback((board: string) => {
    const initial = boardRef.current;
    if (!initial || initial.boards.length <= 1) return;
    const index = initial.boards.indexOf(board);
    const live = useCanvasStore.getState();
    const removed = {
      snapshot: board === initial.activeBoard ? { nodes: live.nodes, edges: live.edges } : initial.snapshots[board],
      messages: initial.messages[board] || [],
    };
    if (board === initial.activeBoard) switchBoard(initial.boards[index + 1] || initial.boards[index - 1]);
    const current = boardRef.current;
    if (!current) return;
    const snapshots = { ...current.snapshots };
    const nextMessages = { ...current.messages };
    delete snapshots[board];
    delete nextMessages[board];
    commitBoards({ ...current, boards: current.boards.filter((item) => item !== board), snapshots, messages: nextMessages });
    notify(`已删除「${board}」`, {
      label: '撤销',
      run: () => {
        const latest = boardRef.current;
        if (!latest || latest.boards.includes(board)) return;
        const restored = [...latest.boards];
        restored.splice(Math.min(index, restored.length), 0, board);
        commitBoards({
          ...latest,
          boards: restored,
          snapshots: { ...latest.snapshots, [board]: removed.snapshot || { nodes: [], edges: [] } },
          messages: { ...latest.messages, [board]: removed.messages },
        });
      },
    });
  }, [commitBoards, notify, switchBoard]);

  const updateMessages = useCallback((updater: (current: StoredChatMessage[]) => StoredChatMessage[]) => {
    const current = boardRef.current;
    if (!current) return;
    commitBoards({
      ...current,
      messages: { ...current.messages, [current.activeBoard]: updater(current.messages[current.activeBoard] || []).slice(-MESSAGE_LIMIT) },
    });
  }, [commitBoards]);

  /* ---------- Agent 方案落到画布 ---------- */

  const placePlan = useCallback((plan: AgentPlan) => {
    if (!plan.nodes.length) return [];
    const created = plan.nodes.map((item) => makeCanvasNode(item.type, { x: 0, y: 0 }, item.type === 'text'
      ? { title: item.title || undefined, prompt: item.prompt, content: item.content }
      : { title: item.title || undefined, prompt: item.prompt || item.content }));
    const newEdges: Edge[] = plan.nodes.flatMap((item, index) => item.from.map((from) => ({
      id: edgeId(created[from].id, created[index].id),
      source: created[from].id,
      target: created[index].id,
      type: 'flow',
    })));
    const items = created.map((node) => ({ id: node.id, x: 0, y: 0, ...nodeSize(node) }));
    const layout = layoutLayers(items, newEdges, { x: 120, y: 64 });
    const width = Math.max(...items.map((item) => layout[item.id].x + item.width));
    const height = Math.max(...items.map((item) => layout[item.id].y + item.height));
    const existing = useCanvasStore.getState().nodes;
    let origin: XYPosition;
    if (existing.length) {
      const right = Math.max(...existing.map((node) => node.position.x + nodeSize(node).width));
      const top = Math.min(...existing.map((node) => node.position.y));
      origin = { x: right + 160, y: top };
    } else {
      const center = visibleCenter();
      origin = { x: center.x - width / 2, y: center.y - height / 2 };
    }
    const positioned = created.map((node) => ({ ...node, position: { x: Math.round(origin.x + layout[node.id].x), y: Math.round(origin.y + layout[node.id].y) } }));
    addNodes(positioned, newEdges);
    const ids = positioned.map((node) => node.id);
    focusNodes(ids, false);
    return ids;
  }, [addNodes, focusNodes, visibleCenter]);

  /* ---------- 快捷键 ---------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      // ⌘J 与 Esc 在输入框里也生效，便于收起 Agent。
      if (mod && key === 'j') {
        event.preventDefault();
        setAgentOpen((open) => !open);
        return;
      }
      if (isEditableTarget(event.target)) return;

      if (event.code === 'Space' && !mod) {
        event.preventDefault();
        if (!event.repeat) setSpacePan(true);
        return;
      }
      if (mod) {
        if (key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
        if (key === 'y') { event.preventDefault(); redo(); return; }
        if (key === 'a') { event.preventDefault(); selectNodes(useCanvasStore.getState().nodes.map((node) => node.id)); return; }
        if (key === 'c') { copySelection(false); return; }
        if (key === 'x') { event.preventDefault(); copySelection(true); return; }
        if (key === 'd') { event.preventDefault(); const ids = useCanvasStore.getState().selectedNodes; if (ids.length) duplicateNodes(ids); return; }
        if (key === 'f') { event.preventDefault(); setSearchOpen(true); return; }
        if (key === 'enter') { event.preventDefault(); runSelected(); return; }
        if (key === '=' || key === '+') { event.preventDefault(); void flow.zoomIn({ duration: 160 }); return; }
        if (key === '-') { event.preventDefault(); void flow.zoomOut({ duration: 160 }); return; }
        if (key === 'g') { event.preventDefault(); if (event.shiftKey) ungroupSelection(); else groupSelection(); return; }
        if (key === 'l' && event.shiftKey) { event.preventDefault(); toggleLockSelection(); return; }
        return;
      }
      if (event.altKey) {
        // ⌥ 在 macOS 上会改变 key，按物理键位匹配对齐快捷键。
        const align = ALIGN_ACTIONS.find((item) => item.code === event.code && Boolean(item.shift) === event.shiftKey);
        if (align && useCanvasStore.getState().selectedNodes.length > 1) {
          event.preventDefault();
          alignSelection(align.mode);
        }
        return;
      }
      if (event.shiftKey && event.code === 'Digit1') { event.preventDefault(); void flow.fitView(FIT_OPTIONS); return; }
      if (event.shiftKey && event.code === 'Digit0') { event.preventDefault(); void flow.zoomTo(1, { duration: 200 }); return; }
      if (event.key === '?') { event.preventDefault(); setShortcutsOpen(true); return; }
      if (event.shiftKey) return;
      if (key === 'v') { setTool('select'); return; }
      if (key === 'h') { setTool('pan'); return; }
      const kind = NODE_CATALOG_LIST.find((item) => item.shortcut.toLowerCase() === key)?.kind;
      if (kind) { event.preventDefault(); addFromShortcut(kind); return; }
      const annotation = ANNOTATION_CATALOG_LIST.find((item) => item.shortcut?.toLowerCase() === key)?.kind;
      if (annotation) { event.preventDefault(); addAnnotationAt(annotation, insertionPoint()); return; }
      if (key === 'escape') {
        setSearchOpen(false);
        if (useCanvasStore.getState().selectedNodes.length) selectNodes([]);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpacePan(false);
    };
    const onBlur = () => setSpacePan(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [addAnnotationAt, addFromShortcut, alignSelection, copySelection, duplicateNodes, flow, groupSelection, insertionPoint, redo, runSelected, selectNodes, toggleLockSelection, undo, ungroupSelection]);

  /* ---------- 右键菜单 ---------- */

  const openMenu = (event: ReactMouseEvent | MouseEvent, kind: MenuState['kind'], nodeId?: string) => {
    event.preventDefault();
    setPicker(null);
    const screen = { x: event.clientX, y: event.clientY };
    setMenu({ screen, flow: flow.screenToFlowPosition(screen), kind, nodeId });
  };

  const menuNode = menu?.nodeId ? nodes.find((node) => node.id === menu.nodeId) : undefined;
  const menuIds = menu?.kind === 'selection' ? selectedIds : menu?.nodeId ? [menu.nodeId] : [];
  const menuNodes = nodes.filter((node) => menuIds.includes(node.id));
  const menuLabel = menuNode && (isCanvasNodeKind(menuNode.type) ? `${NODE_CATALOG[menuNode.type].label}节点` : isAnnotationKind(menuNode.type) ? ANNOTATION_LABEL[menuNode.type] : '');
  const menuGenerative = menuNodes.some((node) => isCanvasNodeKind(node.type));
  const menuAllLocked = menuNodes.length > 0 && menuNodes.every((node) => node.data?.locked);
  // 右键单个分组删除时连同组内节点；键盘 ⌫ 只删画框，与解散相同。
  const menuGroup = menu?.kind === 'node' && menuNode?.type === 'group' ? menuNode : undefined;

  const actions = useMemo<CanvasActions>(() => ({ openPicker, openMedia: setMedia, notify }), [notify, openPicker]);

  const panning = tool === 'pan' || spacePan;

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <CanvasActionsContext.Provider value={actions}>
          <main
            ref={wrapperRef}
            className="lizuo-canvas absolute inset-0 min-h-0 overflow-hidden text-foreground"
            data-tool={panning ? 'pan' : 'select'}
            data-space-pan={spacePan || undefined}
            data-connecting={connecting || undefined}
            onPointerMove={(event) => { pointerRef.current = { x: event.clientX, y: event.clientY }; }}
            onDoubleClick={(event) => {
              const target = event.target as Element;
              // 双击空白处或分组内的空白处都可添加节点。
              if (target.classList?.contains('react-flow__pane') || target.classList?.contains('canvas-group')) openPicker({ x: event.clientX, y: event.clientY });
            }}
            onDragOver={(event: DragEvent) => {
              if (!event.dataTransfer.types.includes('Files')) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
              setDragOver(true);
            }}
            onDragLeave={(event: DragEvent) => {
              if (!wrapperRef.current?.contains(event.relatedTarget as Element | null)) setDragOver(false);
            }}
            onDrop={(event: DragEvent) => {
              if (!event.dataTransfer.files.length) return;
              event.preventDefault();
              setDragOver(false);
              void importFiles([...event.dataTransfer.files], flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectStart={() => { setConnecting(true); setPicker(null); setMenu(null); }}
              onConnectEnd={handleConnectEnd}
              isValidConnection={isValidConnection}
              connectOnClick={false}
              connectionDragThreshold={4}
              connectionRadius={28}
              onNodeDragStart={(_, __, dragged) => beginDrag(dragged)}
              onNodeDrag={(_, __, dragged) => followDrag(dragged)}
              onNodeDragStop={(_, __, dragged) => endDrag(dragged)}
              onSelectionDragStart={(_, dragged) => beginDrag(dragged)}
              onSelectionDrag={(_, dragged) => followDrag(dragged)}
              onSelectionDragStop={(_, dragged) => endDrag(dragged)}
              onPaneClick={() => { setPicker(null); setMenu(null); }}
              onPaneContextMenu={(event) => openMenu(event, 'pane')}
              onNodeContextMenu={(event, node) => {
                const multi = node.selected && useCanvasStore.getState().selectedNodes.length > 1;
                if (!node.selected) selectNodes([node.id]);
                openMenu(event, multi ? 'selection' : 'node', node.id);
              }}
              onSelectionContextMenu={(event) => openMenu(event, 'selection')}
              onMoveEnd={(_, viewport) => setZoom(viewport.zoom)}
              deleteKeyCode={['Backspace', 'Delete']}
              onBeforeDelete={handleBeforeDelete}
              selectionKeyCode="Shift"
              multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
              selectionOnDrag={!panning}
              panOnDrag={panning ? true : [1]}
              selectionMode={SelectionMode.Partial}
              panOnScroll
              zoomOnPinch
              zoomOnDoubleClick={false}
              snapToGrid={snapToGrid}
              snapGrid={SNAP_GRID}
              minZoom={0.1}
              maxZoom={3}
              fitView
              fitViewOptions={{ padding: 0.24, maxZoom: 1 }}
              proOptions={{ hideAttribution: true }}
              className="design-work-flow h-full w-full"
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.8} color="var(--canvas-dot)" />
              <CanvasControls snapToGrid={snapToGrid} onSnapToGridChange={setSnapToGrid} />
              <SelectionToolbar
                ids={selectedIds}
                runnable={selectionStats.runnable}
                generating={selectionStats.generating}
                allLocked={selectionStats.allLocked}
                onRun={() => runSelected(selectedIds)}
                onStop={() => stopSelection(selectedIds)}
                onAlign={(mode) => alignSelection(mode, selectedIds)}
                onGroup={() => groupSelection(selectedIds)}
                onToggleLock={() => toggleLockSelection(selectedIds)}
                onTidy={() => tidy(selectedIds)}
                onDuplicate={() => duplicateNodes(selectedIds)}
                onDisconnect={() => disconnectNodes(selectedIds)}
                onDelete={() => deleteWithUndo(selectedIds)}
              />
            </ReactFlow>

            <AnimatePresence>
              {boardState && nodes.length === 0 && (
                <CanvasEmptyState
                  key="empty"
                  onAdd={(kind) => addNodeAt(kind, visibleCenter())}
                  onUpload={() => openUpload(visibleCenter())}
                  onOpenAgent={() => setAgentOpen(true)}
                />
              )}
            </AnimatePresence>

            <CanvasHeader
              onBack={onBack}
              boards={boards}
              activeBoard={activeBoard}
              onSwitchBoard={switchBoard}
              onCreateBoard={createBoard}
              onRenameBoard={renameBoard}
              onDeleteBoard={deleteBoard}
            />
            <CanvasTopActions agentOpen={agentOpen} agentWidth={AGENT_PANEL_WIDTH} onToggleAgent={() => setAgentOpen((open) => !open)} />
            <CanvasRail
              tool={tool}
              onToolChange={setTool}
              onAdd={(kind) => addNodeAt(kind, visibleCenter())}
              onAddAnnotation={addAnnotation}
              onUpload={() => openUpload()}
              onTidy={() => tidy()}
              onShowShortcuts={() => setShortcutsOpen(true)}
              searchOpen={searchOpen}
              onSearchOpenChange={setSearchOpen}
              onFocusNode={(id) => focusNodes([id])}
            />
            <CanvasAgentPanel
              open={agentOpen}
              board={activeBoard}
              messages={messages}
              onMessagesChange={updateMessages}
              onClose={() => setAgentOpen(false)}
              onPlacePlan={placePlan}
              onRunNodes={(ids) => {
                const live = useCanvasStore.getState().nodes.map((node) => node.id);
                const present = ids.filter((id) => live.includes(id));
                if (present.length) void runNodesInOrder(present).then((summary) => notify(describeRunSummary(summary)));
                else notify('这些节点已不在当前画布上');
              }}
              onFocusNodes={(ids) => {
                const live = new Set(useCanvasStore.getState().nodes.map((node) => node.id));
                const present = ids.filter((id) => live.has(id));
                if (present.length) focusNodes(present);
                else notify('这些节点已不在当前画布上');
              }}
            />

            <NodePicker
              point={picker?.screen ?? null}
              title={picker?.connect ? (picker.connect.side === 'source' ? '添加下游节点' : '添加上游节点') : '添加节点'}
              onPick={createFromPicker}
              onPickAnnotation={picker?.connect ? undefined : createAnnotationFromPicker}
              onUpload={picker?.connect ? undefined : () => openUpload(picker?.flow)}
              onClose={() => setPicker(null)}
            />

            <AnchoredMenu point={menu?.screen ?? null} onClose={() => setMenu(null)} label="画布菜单">
              {menu?.kind === 'pane' && (
                <>
                  <DropdownMenuLabel>添加到此处</DropdownMenuLabel>
                  {NODE_CATALOG_LIST.map((item) => (
                    <DropdownMenuItem key={item.kind} icon={item.icon} shortcut={item.shortcut} onSelect={() => addNodeAt(item.kind, menu.flow)}>{item.label}</DropdownMenuItem>
                  ))}
                  {ANNOTATION_CATALOG_LIST.map((item) => (
                    <DropdownMenuItem key={item.kind} icon={item.icon} shortcut={item.shortcut} onSelect={() => addAnnotationAt(item.kind, menu.flow)}>{item.label}</DropdownMenuItem>
                  ))}
                  <DropdownMenuItem icon={Upload} onSelect={() => openUpload(menu.flow)}>上传图片或视频</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem icon={Clipboard} shortcut="⌘V" disabled={!clipboardRef.current} onSelect={() => pasteClipboard(clipboardRef.current, menu.flow)}>粘贴</DropdownMenuItem>
                  <DropdownMenuItem icon={SelectAll} shortcut="⌘A" disabled={!nodes.length} onSelect={() => selectNodes(nodes.map((node) => node.id))}>全选</DropdownMenuItem>
                  <DropdownMenuItem icon={LayoutMasonry} disabled={nodes.length < 2} onSelect={() => tidy()}>整理布局</DropdownMenuItem>
                  <DropdownMenuItem icon={Focus} shortcut="⇧1" disabled={!nodes.length} onSelect={() => void flow.fitView(FIT_OPTIONS)}>适应画布</DropdownMenuItem>
                </>
              )}
              {(menu?.kind === 'node' || menu?.kind === 'selection') && (
                <>
                  {menu.kind === 'node' && menuLabel && <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>}
                  {menu.kind === 'selection' && <DropdownMenuLabel>已选 {menuIds.length} 个节点</DropdownMenuLabel>}
                  {menuGenerative && (
                    <DropdownMenuItem
                      icon={AiGenerate}
                      shortcut="⌘↵"
                      disabled={!menuNodes.some((node) => isNodeRunnable(node, nodes, edges))}
                      onSelect={() => runSelected(menuIds)}
                    >
                      {menu.kind === 'selection' ? '按顺序全部生成' : '生成'}
                    </DropdownMenuItem>
                  )}
                  {menuNodes.some((node) => node.data?.isGenerating) && (
                    <DropdownMenuItem icon={StopFill} onSelect={() => stopSelection(menuIds)}>停止生成</DropdownMenuItem>
                  )}
                  <DropdownMenuItem icon={Copy} shortcut="⌘D" onSelect={() => duplicateNodes(menuIds)}>创建副本</DropdownMenuItem>
                  <DropdownMenuItem icon={Clipboard} shortcut="⌘C" onSelect={() => copySelection(false)}>复制</DropdownMenuItem>
                  {menu.kind === 'selection' && <DropdownMenuItem icon={LayoutMasonry} onSelect={() => tidy(menuIds)}>整理所选</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  {menuNodes.some((node) => node.type !== 'group') && (
                    <DropdownMenuItem icon={Artboard} shortcut="⌘G" onSelect={() => groupSelection(menuIds)}>编组</DropdownMenuItem>
                  )}
                  {menuNodes.some((node) => node.type === 'group') && (
                    <DropdownMenuItem icon={Layers} shortcut="⇧⌘G" onSelect={() => ungroupSelection(menuIds)}>解散分组</DropdownMenuItem>
                  )}
                  <DropdownMenuItem icon={menuAllLocked ? Unlock : Lock} shortcut="⇧⌘L" onSelect={() => toggleLockSelection(menuIds)}>
                    {menuAllLocked ? '解锁' : '锁定'}
                  </DropdownMenuItem>
                  {menuGenerative && (
                    <DropdownMenuItem
                      icon={Unlink}
                      disabled={!edges.some((edge) => menuIds.includes(edge.source) || menuIds.includes(edge.target))}
                      onSelect={() => disconnectNodes(menuIds)}
                    >
                      断开连线
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    icon={Trash2}
                    shortcut={menuGroup ? undefined : '⌫'}
                    destructive
                    disabled={menuAllLocked}
                    onSelect={() => deleteWithUndo(menuGroup ? [menuGroup.id, ...groupMemberIds(menuGroup, nodes)] : menuIds)}
                  >
                    {menuGroup ? '删除分组及组内节点' : '删除'}
                  </DropdownMenuItem>
                </>
              )}
            </AnchoredMenu>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.txt,.md"
              className="sr-only"
              onChange={(event) => {
                const files = [...(event.target.files || [])];
                event.target.value = '';
                if (files.length) void importFiles(files, uploadTargetRef.current ?? visibleCenter());
              }}
            />

            <DropOverlay visible={dragOver} />
            <CanvasToast toast={toast} onDismiss={() => setToast(null)} />
            <MediaLightbox media={media} onClose={() => setMedia(null)} />
            <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
            <span className="sr-only" aria-live="polite">{connecting ? '正在连线，松开到节点上完成连接，松开到空白处新建节点' : ''}</span>
            {connecting && (
              <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full bg-foreground/85 px-3 py-1.5 text-[11px] font-medium text-background">
                松开到节点上完成连接，松开到空白处新建节点
              </div>
            )}
          </main>
        </CanvasActionsContext.Provider>
      </TooltipProvider>
    </MotionConfig>
  );
};

export const Canvas = ({ onBack }: { onBack?: () => void }) => (
  <ReactFlowProvider>
    <CanvasInner onBack={onBack} />
  </ReactFlowProvider>
);
