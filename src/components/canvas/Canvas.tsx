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
  Hand,
  ImagePlus,
  LayoutGrid,
  ListFilter,
  Loader2,
  Map,
  MessageSquareText,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Send,
  Settings2,
  Type,
  Upload,
  Video,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getConfiguredModels, getSelectedModel, modelSupportsCategory, useProviderStore } from '../../stores/useProviderStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useUIStore } from '../../stores/useUIStore';
import { ImageGenNode } from '../nodes/ImageGenNode';
import { TextNode } from '../nodes/TextNode';
import { VideoNode } from '../nodes/VideoNode';
import { Badge, Button, Card, Input, Select, Textarea } from '../ui';

const nodeTypes = { text: TextNode, imageGen: ImageGenNode, video: VideoNode };
type Tool = 'select' | 'pan';
type ToolbarMenu = 'tool' | 'image' | 'video';
type CanvasNodeType = 'text' | 'imageGen' | 'video';
type ImageGenerationMode = 'text-to-image' | 'image-to-image';
type VideoGenerationMode = 'text-to-video' | 'image-to-video';
type AgentMode = 'auto' | 'ask';
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };
type BoardSnapshot = { nodes: Node[]; edges: Edge[] };

const PROJECT_EMOJIS = ['😀', '✨', '🌱', '🎨', '🚀', '🧩', '🌈', '🪄', '🐻', '🍀', '🌙', '🔥'];

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
  if (type === 'video') return { id, type, position, data: { prompt: '', model: '', generationMode: 'text-to-video', aspectRatio: '16:9', resolution: '1080p', duration: 5, ...data } };
  return { id, type, position, data: { prompt: '', model: '', generationMode: 'text-to-image', style: '', resolution: '1k', aspectRatio: '1:1', isFocusMode: false, ...data } };
};

const CanvasInner = () => {
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [imageGenerationMode, setImageGenerationMode] = useState<ImageGenerationMode>('text-to-image');
  const [videoGenerationMode, setVideoGenerationMode] = useState<VideoGenerationMode>('text-to-video');
  const [toolbarMenu, setToolbarMenu] = useState<ToolbarMenu | null>(null);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [projectEmojiOpen, setProjectEmojiOpen] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [showAgent, setShowAgent] = useState(false);
  const [agentSettingsOpen, setAgentSettingsOpen] = useState(false);
  const [componentQuery, setComponentQuery] = useState('');
  const [componentFilter, setComponentFilter] = useState<'all' | CanvasNodeType>('all');
  const [boards, setBoards] = useState(['画布 1', '画布 2']);
  const [activeBoard, setActiveBoard] = useState('画布 1');
  const [boardNodeCounts, setBoardNodeCounts] = useState<Record<string, number>>({ '画布 1': 0, '画布 2': 0 });
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
  const undo = useCanvasStore((state) => state.undo);
  const redo = useCanvasStore((state) => state.redo);
  const restoreSnapshot = useCanvasStore((state) => state.restoreSnapshot);
  const activeProject = useProjectStore((state) => state.projects.find((project) => project.id === state.activeProjectId));
  const renameProject = useProjectStore((state) => state.renameProject);
  const setProjectEmoji = useProjectStore((state) => state.setProjectEmoji);
  const activeProjectName = activeProject?.name || '创作空间';
  const activeProjectEmoji = activeProject?.emoji || '😀';
  const theme = useUIStore((state) => state.theme);
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

  const beginProjectNameEdit = () => {
    setProjectNameDraft(activeProjectName);
    setEditingProjectName(true);
  };

  const commitProjectName = () => {
    if (activeProject && projectNameDraft.trim()) renameProject(activeProject.id, projectNameDraft);
    setEditingProjectName(false);
  };

  const selectProjectEmoji = (emoji: string) => {
    if (activeProject) setProjectEmoji(activeProject.id, emoji);
    setProjectEmojiOpen(false);
  };

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
    setBoardNodeCounts({ '画布 1': nodes.length, '画布 2': 0 });
    boardsInitializedRef.current = true;
  }, [edges, messages, nodes]);

  useEffect(() => {
    if (!boardsInitializedRef.current) return;
    boardSnapshotsRef.current[activeBoardRef.current] = { nodes, edges };
    setBoardNodeCounts((current) => ({ ...current, [activeBoardRef.current]: nodes.length }));
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
    setBoardNodeCounts((current) => ({ ...current, [currentBoard]: nodes.length }));
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
    setBoardNodeCounts((current) => ({ ...current, [nextName]: 0 }));
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

  useEffect(() => {
    if (!toolbarMenu) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!event.composedPath().includes(toolbarRef.current as EventTarget)) setToolbarMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setToolbarMenu(null);
    };
    window.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [toolbarMenu]);

  useEffect(() => {
    const switchToolWithShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'v') setTool('select');
      if (event.key.toLowerCase() === 'h') setTool('pan');
    };
    window.addEventListener('keydown', switchToolWithShortcut);
    return () => window.removeEventListener('keydown', switchToolWithShortcut);
  }, []);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'y' && event.ctrlKey) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [redo, undo]);

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

  const minimapNodeColor = useMemo(() => (node: Node) => {
    if (theme === 'dark') {
      return node.type === 'imageGen' ? 'rgba(245,245,245,0.34)' : node.type === 'video' ? 'rgba(245,245,245,0.26)' : 'rgba(245,245,245,0.2)';
    }
    return node.type === 'imageGen' ? 'rgba(17,23,19,0.3)' : node.type === 'video' ? 'rgba(17,23,19,0.23)' : 'rgba(17,23,19,0.17)';
  }, [theme]);
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
        <aside className="absolute bottom-3 left-3 top-3 z-40 flex w-[252px] flex-col rounded-xl bg-white/95 shadow-[0_8px_28px_rgba(15,15,15,0.08)] backdrop-blur-xl dark:bg-[#121212]/95 dark:shadow-[0_8px_28px_rgba(0,0,0,0.2)]">
          <div className="flex h-14 shrink-0 items-center gap-1 px-3">
            <div className="relative shrink-0">
              <Button type="button" variant="ghost" size="iconSm" onClick={() => setProjectEmojiOpen((open) => !open)} aria-label="选择项目表情" title="选择项目表情" className="h-8 w-8 rounded-lg bg-muted text-base">{activeProjectEmoji}</Button>
              {projectEmojiOpen && <Card padding="none" className="absolute left-0 top-10 z-50 grid w-[176px] grid-cols-6 gap-1 p-2 shadow-xl">{PROJECT_EMOJIS.map((emoji) => <Button key={emoji} type="button" variant="ghost" size="iconSm" onClick={() => selectProjectEmoji(emoji)} aria-label={`使用${emoji}表情`} className="h-7 w-7 text-base">{emoji}</Button>)}</Card>}
            </div>
            <div className="min-w-0 flex-1 text-xs font-semibold">
              {editingProjectName ? <Input autoFocus value={projectNameDraft} onChange={(event) => setProjectNameDraft(event.target.value)} onBlur={commitProjectName} onKeyDown={(event) => { if (event.key === 'Enter') commitProjectName(); if (event.key === 'Escape') setEditingProjectName(false); }} aria-label="编辑项目名称" inputSize="sm" className="h-8 px-2 text-xs" /> : <button type="button" onDoubleClick={beginProjectNameEdit} className="block w-full truncate text-left" title="双击编辑项目名称">{activeProjectName}</button>}
            </div>
            <Button type="button" variant="ghost" size="iconSm" onClick={() => setShowExplorer(false)} aria-label="收起画布侧栏"><PanelLeftClose size={15} /></Button>
          </div>

          <div className="px-3 pb-2">
            <div className="mb-1 flex h-8 items-center justify-between px-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"><span>画布</span><Button type="button" variant="ghost" size="iconSm" onClick={createBoard} aria-label="新增画布" className="h-6 w-6"><Plus size={13} /></Button></div>
            <div className="space-y-1">
              {boards.map((board) => (
                <Button key={board} type="button" variant="ghost" size="sm" onClick={() => switchBoard(board)} aria-pressed={activeBoard === board} className={cn('h-9 w-full justify-start gap-2 px-2 text-xs', activeBoard === board && 'bg-muted text-foreground hover:bg-muted')}>
                  <LayoutGrid size={14} /><span className="flex-1 truncate text-left">{board}</span><span className="font-mono text-xs opacity-60">{boardNodeCounts[board] || 0}</span>
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
        {!showExplorer && (
          <div className="absolute left-3 top-3 z-30 flex h-10 max-w-[240px] items-center gap-1 rounded-lg border border-black/[0.05] bg-white/90 py-1 pl-3 pr-1 shadow-sm backdrop-blur-xl dark:border-white/[0.07] dark:bg-[#171717]/90">
            <div className="relative shrink-0">
              <Button type="button" variant="ghost" size="iconSm" onClick={() => setProjectEmojiOpen((open) => !open)} aria-label="选择项目表情" title="选择项目表情" className="h-8 w-8 rounded-md text-base">{activeProjectEmoji}</Button>
              {projectEmojiOpen && <Card padding="none" className="absolute left-0 top-10 z-50 grid w-[176px] grid-cols-6 gap-1 p-2 shadow-xl">{PROJECT_EMOJIS.map((emoji) => <Button key={emoji} type="button" variant="ghost" size="iconSm" onClick={() => selectProjectEmoji(emoji)} aria-label={`使用${emoji}表情`} className="h-7 w-7 text-base">{emoji}</Button>)}</Card>}
            </div>
            <div className="min-w-0 flex-1 truncate text-xs font-semibold">{editingProjectName ? <Input autoFocus value={projectNameDraft} onChange={(event) => setProjectNameDraft(event.target.value)} onBlur={commitProjectName} onKeyDown={(event) => { if (event.key === 'Enter') commitProjectName(); if (event.key === 'Escape') setEditingProjectName(false); }} aria-label="编辑项目名称" inputSize="sm" className="h-8 px-2 text-xs" /> : <button type="button" onDoubleClick={beginProjectNameEdit} className="block w-full truncate text-left" title="双击编辑项目名称">{activeProjectName}</button>}</div>
            <Button type="button" variant="ghost" size="iconSm" onClick={() => setShowExplorer(true)} aria-label="展开画布侧栏" title="展开项目面板" className="h-8 w-8 shrink-0"><PanelLeftOpen size={15} /></Button>
          </div>
        )}

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
          deleteKeyCode={['Backspace', 'Delete']}
          fitView
          fitViewOptions={{ padding: 0.28, maxZoom: 0.95 }}
          panOnDrag={tool === 'pan'}
          selectionOnDrag={tool === 'select'}
          selectionMode={SelectionMode.Partial}
          panOnScroll
          zoomOnPinch
          minZoom={0.15}
          maxZoom={2.5}
          defaultEdgeOptions={{ type: 'smoothstep', animated: true, style: { stroke: '#8a948d', strokeWidth: 1.4 } }}
          proOptions={{ hideAttribution: true }}
          className="mboard-flow h-full w-full bg-white dark:bg-[#0b0b0b]"
        >
          <Background gap={18} size={0.8} color="rgba(116,124,114,0.13)" />
          {showMinimap && (
            <MiniMap
              pannable
              zoomable
              nodeColor={minimapNodeColor}
              nodeStrokeColor={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(17,23,19,0.08)'}
              nodeStrokeWidth={1}
              bgColor={theme === 'dark' ? 'rgba(18,18,18,0.58)' : 'rgba(255,255,255,0.58)'}
              maskColor={theme === 'dark' ? 'rgba(5,5,5,0.3)' : 'rgba(255,255,255,0.3)'}
              maskStrokeColor={theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(17,23,19,0.1)'}
              maskStrokeWidth={1}
              style={{ width: 192, height: 108, backdropFilter: 'blur(18px) saturate(120%)' }}
              className={cn(
                '!bottom-3 !left-auto !m-0 !overflow-hidden !rounded-lg !border-black/[0.06] !shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:!border-white/[0.08] dark:!shadow-[0_8px_24px_rgba(0,0,0,0.18)]',
                showAgent ? '!right-[376px]' : '!right-3',
              )}
            />
          )}
        </ReactFlow>

        <input ref={mediaInputRef} type="file" accept="image/*,video/*,.txt,.md" className="sr-only" onChange={(event) => { importMedia(event.target.files?.[0]); event.target.value = ''; }} />

        <Card ref={toolbarRef} padding="sm" className="absolute bottom-3 left-1/2 z-30 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2 overflow-visible border-black/[0.06] bg-white/94 p-1 shadow-[0_8px_28px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#171717]/94">
          <div className="relative">
            <div role="group" aria-label="画布操作工具" className="flex h-8 overflow-hidden rounded-md bg-muted">
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={() => setToolbarMenu(null)}
                aria-label={tool === 'select' ? '当前工具：选择与移动' : '当前工具：拖动画布'}
                title={tool === 'select' ? '选择与移动（V）' : '拖动画布（H）'}
                className="h-8 w-8 rounded-r-none bg-foreground p-0 text-background hover:bg-foreground/90 hover:text-background"
              >
                {tool === 'select' ? <MousePointer2 size={14} /> : <Hand size={14} />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={() => setToolbarMenu((menu) => menu === 'tool' ? null : 'tool')}
                aria-label="展开画布操作工具"
                aria-haspopup="menu"
                aria-expanded={toolbarMenu === 'tool'}
                title="选择画布操作工具"
                className="h-8 w-5 rounded-l-none p-0 text-muted-foreground"
              >
                <ChevronDown size={10} />
              </Button>
            </div>
            {toolbarMenu === 'tool' && (
              <Card role="menu" padding="none" className="absolute bottom-10 left-0 w-40 p-1.5 shadow-xl">
                {([
                  ['select', MousePointer2, '选择与移动', 'V'],
                  ['pan', Hand, '拖动画布', 'H'],
                ] as const).map(([value, Icon, label, shortcut]) => (
                  <Button
                    key={value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    role="menuitemradio"
                    aria-checked={tool === value}
                    onClick={() => { setTool(value); setToolbarMenu(null); }}
                    className={cn('h-9 w-full justify-start gap-2 px-2 text-xs', tool === value && 'bg-muted text-foreground')}
                  >
                    <Icon size={14} />
                    <span className="flex-1 text-left">{label}</span>
                    <kbd className="text-[10px] text-muted-foreground">{shortcut}</kbd>
                  </Button>
                ))}
              </Card>
            )}
          </div>
          <CanvasToolButton icon={Upload} label="上传素材" onClick={() => mediaInputRef.current?.click()} />
          <CanvasToolButton icon={Type} label="添加文字" onClick={() => addAtCenter('text')} />
          <div className="relative">
            <div role="group" aria-label="生成图片" className="flex h-8 overflow-hidden rounded-md">
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={() => addAtCenter('imageGen', { generationMode: imageGenerationMode })}
                aria-label="生成图片"
                title={`生成图片（${imageGenerationMode === 'text-to-image' ? '文生图' : '图生图'}）`}
                className="h-8 w-8 rounded-r-none p-0"
              >
                <ImagePlus size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={() => setToolbarMenu((menu) => menu === 'image' ? null : 'image')}
                aria-label="展开图片生成方式"
                aria-haspopup="menu"
                aria-expanded={toolbarMenu === 'image'}
                title="选择图片生成方式"
                className="h-8 w-5 rounded-l-none p-0 text-muted-foreground"
              >
                <ChevronDown size={10} />
              </Button>
            </div>
            {toolbarMenu === 'image' && (
              <Card role="menu" padding="none" className="absolute bottom-10 left-0 w-36 p-1.5 shadow-xl">
                {([
                  ['text-to-image', Type, '文生图'],
                  ['image-to-image', ImagePlus, '图生图'],
                ] as const).map(([mode, Icon, label]) => (
                  <Button key={mode} type="button" variant="ghost" size="sm" role="menuitemradio" aria-checked={imageGenerationMode === mode} onClick={() => { setImageGenerationMode(mode); addAtCenter('imageGen', { generationMode: mode }); setToolbarMenu(null); }} className={cn('h-9 w-full justify-start gap-2 px-2 text-xs', imageGenerationMode === mode && 'bg-muted text-foreground')}>
                    <Icon size={14} />{label}
                  </Button>
                ))}
              </Card>
            )}
          </div>
          <div className="relative">
            <div role="group" aria-label="生成视频" className="flex h-8 overflow-hidden rounded-md">
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={() => addAtCenter('video', { generationMode: videoGenerationMode })}
                aria-label="生成视频"
                title={`生成视频（${videoGenerationMode === 'text-to-video' ? '文生视频' : '图生视频'}）`}
                className="h-8 w-8 rounded-r-none p-0"
              >
                <Video size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={() => setToolbarMenu((menu) => menu === 'video' ? null : 'video')}
                aria-label="展开视频生成方式"
                aria-haspopup="menu"
                aria-expanded={toolbarMenu === 'video'}
                title="选择视频生成方式"
                className="h-8 w-5 rounded-l-none p-0 text-muted-foreground"
              >
                <ChevronDown size={10} />
              </Button>
            </div>
            {toolbarMenu === 'video' && (
              <Card role="menu" padding="none" className="absolute bottom-10 left-0 w-40 p-1.5 shadow-xl">
                {([
                  ['text-to-video', Type, '文生视频'],
                  ['image-to-video', ImagePlus, '图生视频'],
                ] as const).map(([mode, Icon, label]) => (
                  <Button key={mode} type="button" variant="ghost" size="sm" role="menuitemradio" aria-checked={videoGenerationMode === mode} onClick={() => { setVideoGenerationMode(mode); addAtCenter('video', { generationMode: mode }); setToolbarMenu(null); }} className={cn('h-9 w-full justify-start gap-2 px-2 text-xs', videoGenerationMode === mode && 'bg-muted text-foreground')}>
                    <Icon size={14} />{label}
                  </Button>
                ))}
              </Card>
            )}
          </div>
          <span aria-hidden="true" className="h-6 w-px shrink-0 bg-black/[0.08] dark:bg-white/[0.1]" />
          <div className="flex h-8 items-center gap-1 rounded-lg bg-black/[0.05] p-0.5 dark:bg-white/[0.07]">
            <CanvasToolButton icon={Map} label="小地图" active={showMinimap} onClick={() => setShowMinimap((visible) => !visible)} className="h-7 w-7" />
            <CanvasToolButton icon={Bot} label={showAgent ? '收起 Agent' : '展开 Agent'} active={showAgent} onClick={() => setShowAgent((visible) => !visible)} className="h-7 w-7" />
          </div>
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
        <aside className="absolute bottom-3 right-3 top-3 z-40 flex w-[352px] flex-col rounded-xl bg-white/[0.96] shadow-[0_8px_28px_rgba(15,15,15,0.08)] backdrop-blur-xl dark:bg-[#121212]/[0.96] dark:shadow-[0_8px_28px_rgba(0,0,0,0.22)]">
          <header className="flex h-14 shrink-0 items-center gap-2 px-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-foreground"><Bot size={16} /></span><div className="min-w-0 flex-1"><div className="text-xs font-semibold">Canvas Agent</div><div className="truncate text-xs text-muted-foreground">{agentWorking ? `正在操作 ${activeBoard}` : `当前画布：${activeBoard}`}</div></div><Button type="button" variant="ghost" size="iconSm" onClick={() => setAgentSettingsOpen((open) => !open)} aria-label="Agent 设置"><Settings2 size={15} /></Button></header>

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

const CanvasToolButton = ({ icon: Icon, label, active, disabled, onClick, className }: { icon: React.ElementType; label: string; active?: boolean; disabled?: boolean; onClick: () => void; className?: string }) => (
  <Button type="button" variant={active ? 'secondary' : 'ghost'} size="iconSm" aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick} className={cn('h-8 w-8 shrink-0', className)}><Icon size={14} strokeWidth={active ? 2.2 : 1.8} /></Button>
);

export const Canvas = () => <ReactFlowProvider><CanvasInner /></ReactFlowProvider>;
