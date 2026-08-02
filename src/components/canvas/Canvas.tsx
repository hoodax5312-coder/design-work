import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Bot,
  ChevronDown,
  Download,
  Hand,
  ImagePlus,
  LayoutGrid,
  ListFilter,
  Loader2,
  MessageSquareText,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Video,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getConfiguredModels, getSelectedModel, modelSupportsCategory, useProviderStore } from '../../stores/useProviderStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { ImageGenNode } from '../nodes/ImageGenNode';
import { TextNode } from '../nodes/TextNode';
import { VideoNode } from '../nodes/VideoNode';
import { Badge, Button, Card, Input, Select, Textarea } from '../ui';

const nodeTypes = { text: TextNode, imageGen: ImageGenNode, video: VideoNode };
type Tool = 'select' | 'pan';
type CanvasNodeType = 'text' | 'imageGen' | 'video';
type AgentMode = 'auto' | 'ask';
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };
type BoardSnapshot = { nodes: Node[]; edges: Edge[] };

const createWelcomeMessage = (board: string): ChatMessage => ({
  id: `welcome-${board}`,
  role: 'assistant',
  content: `当前正在操作「${board}」。告诉我你想创建什么，我可以把文本、图片和视频任务直接放到这个画布。`,
});

const NODE_META: Record<CanvasNodeType, { label: string; icon: React.ElementType; dot: string }> = {
  text: { label: '文本', icon: Type, dot: 'bg-zinc-400' },
  imageGen: { label: '图片', icon: ImagePlus, dot: 'bg-primary' },
  video: { label: '视频', icon: Video, dot: 'bg-sky-400' },
};

const makeNode = (type: CanvasNodeType, position: { x: number; y: number }, data: Record<string, unknown> = {}): Node => {
  const id = crypto.randomUUID();
  if (type === 'text') return { id, type, position, data: { content: '', prompt: '', mode: 'edit', ...data } };
  if (type === 'video') return { id, type, position, data: { prompt: '', model: '', aspectRatio: '16:9', resolution: '1080p', duration: 5, ...data } };
  return { id, type, position, data: { prompt: '', model: '', style: '', resolution: '1k', aspectRatio: '1:1', isFocusMode: false, ...data } };
};

const CanvasInner = () => {
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const workflowInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [showMinimap, setShowMinimap] = useState(false);
  const [showExplorer, setShowExplorer] = useState(true);
  const [showAgent, setShowAgent] = useState(true);
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false);
  const [componentQuery, setComponentQuery] = useState('');
  const [componentFilter, setComponentFilter] = useState<'all' | CanvasNodeType>('all');
  const [boards, setBoards] = useState(['画布 1', '画布 2']);
  const [activeBoard, setActiveBoard] = useState('画布 1');
  const activeBoardRef = useRef('画布 1');
  const [notice, setNotice] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>('auto');
  const [agentModel, setAgentModel] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentWorking, setAgentWorking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([createWelcomeMessage('画布 1')]);

  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);
  const addNode = useCanvasStore((state) => state.addNode);
  const clearCanvas = useCanvasStore((state) => state.clearCanvas);
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const canUndo = useCanvasStore((state) => state.canUndo);
  const canRedo = useCanvasStore((state) => state.canRedo);
  const setNodes = useCanvasStore((state) => state.setNodes);
  const setEdges = useCanvasStore((state) => state.setEdges);
  const restoreSnapshot = useCanvasStore((state) => state.restoreSnapshot);
  const boardSnapshotsRef = useRef<Record<string, BoardSnapshot>>({});
  const boardMessagesRef = useRef<Record<string, ChatMessage[]>>({});
  const boardsInitializedRef = useRef(false);

  const providers = useProviderStore((state) => state.providers);
  const activeProviderId = useProviderStore((state) => state.activeProviderId);
  const languageModels = useMemo(() => providers.flatMap((provider) => getConfiguredModels(provider)
    .filter((model) => modelSupportsCategory(model, 'language'))
    .map((model) => ({ value: `${provider.id}::${model.id}`, label: model.id, provider }))), [providers]);
  const fallbackProvider = providers.find((provider) => provider.id === activeProviderId) || languageModels[0]?.provider;
  const resolvedAgentModel = agentModel || (fallbackProvider && getSelectedModel(fallbackProvider, 'language')
    ? `${fallbackProvider.id}::${getSelectedModel(fallbackProvider, 'language')}`
    : languageModels[0]?.value || '');

  useEffect(() => {
    if (boardsInitializedRef.current) return;
    boardSnapshotsRef.current = {
      '画布 1': { nodes, edges },
      '画布 2': { nodes: [], edges: [] },
    };
    boardMessagesRef.current = {
      '画布 1': messages,
      '画布 2': [createWelcomeMessage('画布 2')],
    };
    boardsInitializedRef.current = true;
  }, [edges, messages, nodes]);

  useEffect(() => {
    if (!boardsInitializedRef.current) return;
    boardSnapshotsRef.current[activeBoardRef.current] = { nodes, edges };
  }, [activeBoard, edges, nodes]);

  useEffect(() => {
    if (!boardsInitializedRef.current) return;
    boardMessagesRef.current[activeBoardRef.current] = messages;
  }, [activeBoard, messages]);

  const switchBoard = useCallback((board: string) => {
    const currentBoard = activeBoardRef.current;
    if (board === currentBoard) return;
    boardSnapshotsRef.current[currentBoard] = { nodes, edges };
    boardMessagesRef.current[currentBoard] = messages;
    const nextSnapshot = boardSnapshotsRef.current[board] || { nodes: [], edges: [] };
    const nextMessages = boardMessagesRef.current[board] || [createWelcomeMessage(board)];
    activeBoardRef.current = board;
    setActiveBoard(board);
    setMessages(nextMessages);
    setComponentQuery('');
    setComponentFilter('all');
    restoreSnapshot(nextSnapshot.nodes, nextSnapshot.edges);
    window.setTimeout(() => void flowRef.current?.fitView({ duration: 220, padding: 0.28 }), 20);
  }, [edges, messages, nodes, restoreSnapshot]);

  const createBoard = useCallback(() => {
    const nextName = `画布 ${boards.length + 1}`;
    boardSnapshotsRef.current[nextName] = { nodes: [], edges: [] };
    boardMessagesRef.current[nextName] = [createWelcomeMessage(nextName)];
    setBoards((current) => [...current, nextName]);
    switchBoard(nextName);
  }, [boards.length, switchBoard]);

  const selectedIds = useMemo(() => new Set(nodes.filter((node) => node.selected).map((node) => node.id)), [nodes]);
  const visibleEdges = useMemo(() => selectedIds.size
    ? edges.filter((edge) => selectedIds.has(edge.source) || selectedIds.has(edge.target))
    : [], [edges, selectedIds]);

  const addAtCenter = useCallback((type: CanvasNodeType, data: Record<string, unknown> = {}) => {
    const center = flowRef.current?.screenToFlowPosition({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.48 });
    const position = center || { x: 180 + nodes.length * 28, y: 120 + nodes.length * 24 };
    const node = makeNode(type, position, data);
    addNode(node);
    window.setTimeout(() => flowRef.current?.setCenter(position.x + 210, position.y + 140, { zoom: 0.9, duration: 260 }), 20);
    setNotice(`已添加${NODE_META[type].label}节点`);
    return node;
  }, [addNode, nodes.length]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  const exportWorkflow = () => {
    const payload = { name: activeBoard, exportedAt: new Date().toISOString(), nodes, edges };
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    anchor.download = `mboard-${activeBoard}-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    setNotice('画布已导出');
  };

  const importWorkflow = async (file?: File) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as { nodes?: Node[]; edges?: Edge[] };
      if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) throw new Error('invalid');
      setNodes(payload.nodes);
      setEdges(payload.edges);
      setNotice('画布已导入');
    } catch {
      setNotice('导入失败，请选择 Mboard 画布 JSON');
    }
  };

  const importMedia = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) addAtCenter('video', { prompt: file.name, previewUrl: url, status: '本地视频已放入画布' });
    else if (file.type.startsWith('image/')) addAtCenter('imageGen', { prompt: file.name, imageUrl: url });
    else addAtCenter('text', { content: file.name });
  };

  const submitAgent = async () => {
    const prompt = agentPrompt.trim();
    if (!prompt || agentWorking) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: prompt }]);
    setAgentPrompt('');
    if (agentMode === 'ask') {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: '已理解任务。切换到「自动执行」后，我会将结果直接放入当前画布。' }]);
      return;
    }
    setAgentWorking(true);
    await new Promise((resolve) => window.setTimeout(resolve, 520));
    const lowerPrompt = prompt.toLowerCase();
    const type: CanvasNodeType = /视频|video|动画|镜头/.test(lowerPrompt) ? 'video' : /图片|图像|image|海报|插画/.test(lowerPrompt) ? 'imageGen' : 'text';
    const data = type === 'text' ? { content: prompt, prompt } : { prompt };
    addAtCenter(type, data);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: `已调用画布工具，并创建${NODE_META[type].label}节点。你可以继续编辑节点内容或连接其他素材。` }]);
    setAgentWorking(false);
  };

  const minimapNodeColor = useMemo(() => (node: Node) => node.type === 'imageGen' ? '#c8ff00' : node.type === 'video' ? '#70a4ff' : '#a9b0a8', []);
  const visibleNodes = nodes.filter((node) => {
    const type = (node.type || 'text') as CanvasNodeType;
    const matchesType = componentFilter === 'all' || type === componentFilter;
    const query = componentQuery.trim().toLowerCase();
    const content = `${NODE_META[type]?.label || '节点'} ${String(node.data?.prompt || '')} ${String(node.data?.content || '')}`.toLowerCase();
    return matchesType && (!query || content.includes(query));
  });

  return (
    <main className="absolute inset-x-0 bottom-0 top-14 min-h-0 overflow-hidden bg-white text-foreground dark:bg-[#0b0b0b]">
      {showExplorer && (
        <aside className="absolute bottom-0 left-3 top-3 z-40 flex w-[252px] flex-col rounded-t-xl bg-white/95 shadow-[0_8px_28px_rgba(15,15,15,0.08)] backdrop-blur-xl dark:bg-[#121212]/95 dark:shadow-[0_8px_28px_rgba(0,0,0,0.2)]">
          <div className="flex h-14 shrink-0 items-center gap-2 px-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-xs font-black text-primary-foreground">M</span>
            <Button type="button" variant="ghost" size="sm" className="min-w-0 flex-1 justify-start px-2 text-xs"><span className="truncate">创作空间</span><ChevronDown size={13} className="ml-auto" /></Button>
            <Button type="button" variant="ghost" size="iconSm" onClick={() => setShowExplorer(false)} aria-label="收起画布侧栏"><PanelLeftClose size={15} /></Button>
          </div>

          <div className="px-3 pb-2">
            <div className="mb-1 flex h-8 items-center justify-between px-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"><span>画布</span><Button type="button" variant="ghost" size="iconSm" onClick={createBoard} aria-label="新增画布" className="h-6 w-6"><Plus size={13} /></Button></div>
            <div className="space-y-1">
              {boards.map((board) => (
                <Button key={board} type="button" variant="ghost" size="sm" onClick={() => switchBoard(board)} aria-pressed={activeBoard === board} className={cn('h-9 w-full justify-start gap-2 px-2 text-xs', activeBoard === board && 'bg-muted text-foreground hover:bg-muted')}>
                  <LayoutGrid size={14} /><span className="flex-1 truncate text-left">{board}</span><span className="font-mono text-xs opacity-60">{board === activeBoard ? nodes.length : boardSnapshotsRef.current[board]?.nodes.length || 0}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2">
            <div className="mb-2 flex h-8 items-center justify-between px-2"><span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">组件 <span className="ml-1 font-mono">{visibleNodes.length}</span></span><ListFilter size={13} className="text-muted-foreground" /></div>
            <label className="mb-2 flex h-9 items-center gap-2 rounded-lg bg-muted/70 px-2.5"><Search size={13} className="text-muted-foreground" /><Input inputSize="sm" aria-label="搜索画布组件" value={componentQuery} onChange={(event) => setComponentQuery(event.target.value)} placeholder="搜索画布内容" variant="ghost" className="h-8 flex-1 px-0 text-xs" /></label>
            <div className="mb-2 flex gap-1">{([['all', '全部'], ['text', '文本'], ['imageGen', '图片'], ['video', '视频']] as const).map(([value, label]) => <Button key={value} type="button" variant={componentFilter === value ? 'secondary' : 'ghost'} size="sm" onClick={() => setComponentFilter(value)} className="h-7 flex-1 px-1 text-xs">{label}</Button>)}</div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {visibleNodes.length ? visibleNodes.map((node) => {
                const type = (node.type || 'text') as CanvasNodeType;
                const meta = NODE_META[type] || NODE_META.text;
                const Icon = meta.icon;
                const title = String(node.data?.prompt || node.data?.content || meta.label);
                return <Button key={node.id} type="button" variant="ghost" size="sm" onClick={() => flowRef.current?.setCenter(node.position.x + 210, node.position.y + 130, { zoom: 1, duration: 240 })} className="group h-10 w-full justify-start gap-2 px-2 text-xs"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted"><Icon size={12} /></span><span className="min-w-0 flex-1 truncate text-left">{title}</span><span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} /></Button>;
              }) : <div className="px-3 py-8 text-center text-xs leading-5 text-muted-foreground">画布还是空的。使用底部工具栏或右侧 Agent 创建内容。</div>}
            </div>
          </div>
        </aside>
      )}

      <section className="absolute inset-0 z-0 overflow-hidden">
        <div className={cn('absolute top-3 z-30 flex items-center gap-2', showExplorer ? 'left-[276px]' : 'left-3')}>
          {!showExplorer && <Button type="button" variant="secondary" size="iconSm" onClick={() => setShowExplorer(true)} aria-label="展开画布侧栏" className="shadow-sm"><PanelLeftOpen size={15} /></Button>}
          <div className="flex h-8 items-center gap-2 rounded-lg bg-white/90 px-2.5 text-xs font-semibold shadow-sm backdrop-blur-md dark:bg-[#171717]/90"><span className="h-1.5 w-1.5 rounded-full bg-primary" /><span>{activeBoard}</span><span className="font-mono text-muted-foreground">{nodes.length}</span></div>
        </div>
        <div className={cn('absolute top-3 z-30 flex items-center gap-2', showAgent ? 'right-[376px]' : 'right-3')}>
          <Button type="button" variant="secondary" size="sm" onClick={exportWorkflow} className="h-8 bg-white/90 text-xs shadow-sm dark:bg-[#171717]/90"><Download size={13} />导出</Button>
          {!showAgent && <Button type="button" variant="secondary" size="iconSm" onClick={() => setShowAgent(true)} aria-label="展开 Agent" className="shadow-sm"><PanelRightOpen size={15} /></Button>}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={visibleEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(connection: Connection) => onConnect(connection)}
          onInit={(instance) => { flowRef.current = instance; }}
          onPaneContextMenu={(event) => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY }); }}
          onPaneClick={() => setContextMenu(null)}
          fitView
          fitViewOptions={{ padding: 0.28, maxZoom: 0.95 }}
          panOnDrag={tool === 'pan'}
          selectionOnDrag={tool === 'select'}
          selectionMode={SelectionMode.Partial}
          panOnScroll
          zoomOnPinch
          minZoom={0.15}
          maxZoom={2.5}
          defaultEdgeOptions={{ type: 'smoothstep', animated: true, style: { stroke: '#9caf42', strokeWidth: 1.4 } }}
          proOptions={{ hideAttribution: true }}
          className="mboard-flow h-full w-full bg-white dark:bg-[#0b0b0b]"
        >
          <Background gap={18} size={0.8} color="rgba(116,124,114,0.13)" />
          {showMinimap && <MiniMap pannable zoomable nodeColor={minimapNodeColor} className={cn('!bottom-16 !m-0 !rounded-lg !border-black/10 !bg-white/90 dark:!border-white/10 dark:!bg-[#181818]/95', showExplorer ? '!left-[276px]' : '!left-3')} />}
        </ReactFlow>

        <input ref={workflowInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { void importWorkflow(event.target.files?.[0]); event.target.value = ''; }} />
        <input ref={mediaInputRef} type="file" accept="image/*,video/*,.txt,.md" className="sr-only" onChange={(event) => { importMedia(event.target.files?.[0]); event.target.value = ''; }} />

        <Card padding="sm" className="absolute bottom-3 left-1/2 z-30 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto border-black/[0.06] bg-white/94 p-1 shadow-[0_8px_28px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#171717]/94">
          <CanvasToolButton icon={MousePointer2} label="选择" active={tool === 'select'} onClick={() => setTool('select')} />
          <CanvasToolButton icon={Hand} label="移动画布" active={tool === 'pan'} onClick={() => setTool('pan')} />
          <CanvasToolButton icon={Upload} label="上传素材" onClick={() => mediaInputRef.current?.click()} />
          <CanvasToolButton icon={Type} label="添加文本" onClick={() => addAtCenter('text')} />
          <CanvasToolButton icon={ImagePlus} label="添加图片" onClick={() => addAtCenter('imageGen')} />
          <CanvasToolButton icon={Video} label="添加视频" onClick={() => addAtCenter('video')} />
          <CanvasToolButton icon={ZoomOut} label="缩小" onClick={() => { void flowRef.current?.zoomOut({ duration: 160 }); }} />
          <Button type="button" variant="ghost" size="sm" onClick={() => { void flowRef.current?.fitView({ duration: 180, padding: 0.28 }); }} className="h-8 min-w-12 px-2 font-mono text-xs" title="适应画布">适应</Button>
          <CanvasToolButton icon={ZoomIn} label="放大" onClick={() => { void flowRef.current?.zoomIn({ duration: 160 }); }} />
          <CanvasToolButton icon={RotateCcw} label="撤销" disabled={!canUndo()} onClick={undo} />
          <CanvasToolButton icon={Redo2} label="重做" disabled={!canRedo()} onClick={redo} />
          <CanvasToolButton icon={Sparkles} label="小地图" active={showMinimap} onClick={() => setShowMinimap((visible) => !visible)} />
          <CanvasToolButton icon={Upload} label="导入画布" onClick={() => workflowInputRef.current?.click()} />
          <CanvasToolButton icon={Trash2} label="清空画布" onClick={() => { if (nodes.length && window.confirm('确定清空当前画布吗？')) clearCanvas(); }} />
        </Card>

        {contextMenu && (
          <Card padding="sm" className="fixed z-50 w-44 p-1.5 shadow-lg" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseDown={(event) => event.stopPropagation()}>
            <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">添加到画布</p>
            {(['text', 'imageGen', 'video'] as CanvasNodeType[]).map((type) => { const meta = NODE_META[type]; const Icon = meta.icon; return <Button key={type} type="button" variant="ghost" size="sm" onClick={() => { addAtCenter(type); setContextMenu(null); }} className="w-full justify-start text-xs"><Icon size={14} />{meta.label}</Button>; })}
          </Card>
        )}
        {notice && <div role="status" className="absolute bottom-16 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background shadow-lg">{notice}</div>}
      </section>

      {showAgent && (
        <aside className="absolute bottom-0 right-3 top-3 z-40 flex w-[352px] flex-col rounded-t-xl bg-white/[0.96] shadow-[0_8px_28px_rgba(15,15,15,0.08)] backdrop-blur-xl dark:bg-[#121212]/[0.96] dark:shadow-[0_8px_28px_rgba(0,0,0,0.22)]">
          <header className="flex h-14 shrink-0 items-center gap-2 px-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-foreground"><Bot size={16} /></span><div className="min-w-0 flex-1"><div className="text-xs font-semibold">Canvas Agent</div><div className="truncate text-xs text-muted-foreground">{agentWorking ? `正在操作 ${activeBoard}` : `当前画布：${activeBoard}`}</div></div><Button type="button" variant="ghost" size="iconSm" onClick={() => setAgentSettingsOpen((open) => !open)} aria-label="Agent 设置"><Settings2 size={15} /></Button><Button type="button" variant="ghost" size="iconSm" onClick={() => setShowAgent(false)} aria-label="收起 Agent"><PanelRightClose size={15} /></Button></header>

          {agentSettingsOpen && <Card padding="sm" className="absolute right-3 top-12 z-40 w-[310px] p-3 shadow-xl"><div className="mb-2 text-xs font-semibold">Agent 模型</div><Select aria-label="Agent 模型" value={resolvedAgentModel} onChange={(event) => setAgentModel(event.target.value)} selectSize="sm" options={languageModels.length ? languageModels.map(({ value, label }) => ({ value, label })) : [{ value: '', label: '暂无语言模型' }]} disabled={!languageModels.length} /><div className="mb-2 mt-4 text-xs font-semibold">执行模式</div><div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"><Button type="button" variant={agentMode === 'auto' ? 'primary' : 'ghost'} size="sm" onClick={() => setAgentMode('auto')} className="text-xs">自动执行</Button><Button type="button" variant={agentMode === 'ask' ? 'primary' : 'ghost'} size="sm" onClick={() => setAgentMode('ask')} className="text-xs">询问执行</Button></div><p className="mt-2 text-xs leading-4 text-muted-foreground">自动执行会直接创建画布节点；询问执行会先确认任务。</p></Card>}

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.map((message) => <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[88%] rounded-xl px-3 py-2.5 text-xs leading-5', message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}><div className="mb-1 flex items-center gap-1.5 text-xs font-semibold opacity-65">{message.role === 'user' ? <MessageSquareText size={10} /> : <Bot size={10} />}{message.role === 'user' ? '你' : 'Agent'}</div>{message.content}</div></div>)}
            {agentWorking && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin text-primary" />正在调用 create_canvas_item…</div>}
          </div>

          <div className="shrink-0 p-3">
            <Card padding="none" className="overflow-hidden border-black/[0.08] shadow-sm focus-within:border-primary dark:border-white/10">
              <Textarea value={agentPrompt} onChange={(event) => setAgentPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submitAgent(); } }} placeholder="输入消息，Enter 发送" variant="ghost" className="h-20 min-h-20 resize-none px-3 py-3 text-xs leading-5" />
              <div className="flex items-center gap-1 px-2 pb-2"><Button type="button" variant="ghost" size="iconSm" onClick={() => mediaInputRef.current?.click()} aria-label="添加参考素材" className="h-7 w-7"><Plus size={14} /></Button><Button type="button" variant="ghost" size="sm" onClick={() => setAgentSettingsOpen((open) => !open)} className="h-7 min-w-0 max-w-[170px] gap-1 px-2 text-xs text-muted-foreground"><span className="truncate">{languageModels.find((item) => item.value === resolvedAgentModel)?.label || '选择模型'}</span><ChevronDown size={10} /></Button><Badge variant="subtle" className="ml-auto text-xs">{agentMode === 'auto' ? '自动' : '询问'}</Badge><Button type="button" variant="primary" size="iconSm" onClick={() => void submitAgent()} disabled={!agentPrompt.trim() || agentWorking} aria-label="发送给 Agent" className="h-7 w-7 rounded-full"><Send size={12} /></Button></div>
            </Card>
          </div>
        </aside>
      )}
    </main>
  );
};

const CanvasToolButton = ({ icon: Icon, label, active, disabled, onClick }: { icon: React.ElementType; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) => (
  <Button type="button" variant={active ? 'secondary' : 'ghost'} size="iconSm" aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick} className="h-8 w-8 shrink-0"><Icon size={14} strokeWidth={active ? 2.2 : 1.8} /></Button>
);

export const Canvas = () => <ReactFlowProvider><CanvasInner /></ReactFlowProvider>;
