import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AiGenerate, ArrowUp, ChatAi, Check, ChevronDown, ErrorWarning, Focus, Settings, Sparkles, X } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { generateProviderText } from '../../services/providerService';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useProviderStore } from '../../stores/useProviderStore';
import { useUIStore } from '../../stores/useUIStore';
import { AnimatePresence, BorderBeam, ShimmerText, ThinkingOrb, dockVariants, motion, springs, staggerItem } from '../motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '../ui';
import {
  buildAgentPrompt,
  isCanvasNodeKind,
  nodeSummary,
  nodeTitle,
  parseAgentPlan,
  type AgentPlan,
  type CanvasNodeKind,
  type StoredChatMessage,
} from './canvasModel';
import { resolveModelChoice, type ModelOption } from './generation';
import { CanvasNodeParams, CanvasNodeParamsEmpty, type ParamNode } from './CanvasNodeParams';
import { NODE_CATALOG } from './nodeCatalog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';

export const AGENT_PANEL_WIDTH = 380;

type AgentMode = 'auto' | 'confirm';
const MODE_KEY = 'lizuo-canvas-agent-mode';
const MODEL_KEY = 'lizuo-canvas-agent-model';
const SCROLL_BOTTOM_THRESHOLD = 48;

const SUGGESTIONS = [
  '为一款冷萃咖啡做一组 3 张海报，先写文案再出图',
  '把选中的文本扩写成 15 秒短视频分镜',
  '为新品发布规划一条从卖点到主视觉的流程',
];

interface CanvasAgentPanelProps {
  open: boolean;
  board: string;
  messages: StoredChatMessage[];
  onMessagesChange: (updater: (messages: StoredChatMessage[]) => StoredChatMessage[]) => void;
  onClose: () => void;
  /** 把规划放入画布，返回新节点 id；失败返回空数组。 */
  onPlacePlan: (plan: AgentPlan) => string[];
  onRunNodes: (ids: string[]) => void;
  onFocusNodes: (ids: string[]) => void;
  selectedNode?: ParamNode | null;
  selectedCount: number;
  selectedAnnotation?: boolean;
}

const readStored = (key: string) => {
  try { return window.localStorage.getItem(key) || ''; } catch { return ''; }
};
const writeStored = (key: string, value: string) => {
  try { window.localStorage.setItem(key, value); } catch { /* 隐私模式下忽略 */ }
};

const PlanCard = ({ plan, placed, onPlace, onRun, onFocus }: { plan: AgentPlan; placed: boolean; onPlace: () => void; onRun: () => void; onFocus: () => void }) => (
  <div className="mt-2 overflow-hidden rounded-lg border border-border bg-background">
    <ol className="divide-y divide-border">
      {plan.nodes.map((node, index) => {
        const Icon = NODE_CATALOG[node.type].icon;
        return (
          <li key={index} className="flex gap-2 px-2.5 py-2">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-foreground"><Icon size={12} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <span className="truncate">{node.title || NODE_CATALOG[node.type].label}</span>
                {node.from.length > 0 && <span className="shrink-0 text-[10px] font-normal text-muted-foreground">← {node.from.map((from) => from + 1).join('、')}</span>}
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{node.prompt || node.content || '（无提示词）'}</p>
            </div>
          </li>
        );
      })}
    </ol>
    <div className="flex items-center gap-1 border-t border-border bg-muted/40 p-1.5">
      {placed ? (
        <>
          <span className="flex items-center gap-1 px-1.5 text-[11px] text-muted-foreground"><Check size={12} />已放入画布</span>
          <button type="button" onClick={onFocus} className="ml-auto flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"><Focus size={12} />定位</button>
          <button type="button" onClick={onRun} className="flex h-7 items-center gap-1 rounded-md bg-foreground px-2.5 text-[11px] font-medium text-background"><AiGenerate size={12} />生成这些节点</button>
        </>
      ) : (
        <button type="button" onClick={onPlace} className="ml-auto flex h-7 items-center gap-1 rounded-md bg-foreground px-2.5 text-[11px] font-medium text-background">放入画布</button>
      )}
    </div>
  </div>
);

/** 右侧画布 Agent：用已配置的文本模型把需求拆成节点，并按模式放入画布。 */
export const CanvasAgentPanel = ({ open, board, messages, onMessagesChange, onClose, onPlacePlan, onRunNodes, onFocusNodes, selectedNode, selectedCount, selectedAnnotation }: CanvasAgentPanelProps) => {
  const providers = useProviderStore((state) => state.providers);
  const activeProviderId = useProviderStore((state) => state.activeProviderIds.language);
  const setActiveModule = useUIStore((state) => state.setActiveModule);
  const [mode, setMode] = useState<AgentMode>(() => (readStored(MODE_KEY) === 'confirm' ? 'confirm' : 'auto'));
  const [storedModel, setStoredModel] = useState(() => readStored(MODEL_KEY));
  const [draft, setDraft] = useState('');
  const [working, setWorking] = useState(false);
  const [activeTab, setActiveTab] = useState<'params' | 'agent'>('agent');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef(0);
  const scrollRef = useRef({ board, initialized: false, visible: false, top: 0, pinned: true });

  const choice = useMemo(() => {
    const [providerId, ...model] = storedModel.split('::');
    return resolveModelChoice({ providerId, model: model.join('::') }, 'language', providers, activeProviderId);
  }, [activeProviderId, providers, storedModel]);

  const selectedNodeId = selectedNode?.id;

  useEffect(() => {
    if (selectedNodeId) setActiveTab('params');
  }, [selectedNodeId]);

  useEffect(() => {
    if (!open || activeTab !== 'agent') return;
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 120);
    return () => window.clearTimeout(timer);
  }, [activeTab, open]);

  useLayoutEffect(() => {
    const state = scrollRef.current;
    if (state.board !== board) {
      state.board = board;
      state.initialized = false;
      state.visible = false;
      state.top = 0;
      state.pinned = true;
    }

    const list = listRef.current;
    const visible = open && activeTab === 'agent' && Boolean(list) && Boolean(list?.clientHeight);
    if (!visible || !list) {
      state.visible = false;
      return;
    }

    const becameVisible = !state.visible;
    state.visible = true;
    if (!state.initialized) {
      list.scrollTop = list.scrollHeight;
      state.top = list.scrollTop;
      state.pinned = true;
      state.initialized = true;
      return;
    }

    if (becameVisible) {
      list.scrollTop = Math.min(state.top, Math.max(0, list.scrollHeight - list.clientHeight));
      state.top = list.scrollTop;
      state.pinned = list.scrollHeight - list.scrollTop - list.clientHeight <= SCROLL_BOTTOM_THRESHOLD;
      return;
    }

    if (state.pinned) {
      list.scrollTop = list.scrollHeight;
      state.top = list.scrollTop;
    }
  }, [activeTab, board, messages, open, working]);

  const handleListScroll = () => {
    const list = listRef.current;
    const state = scrollRef.current;
    if (!list || !open || activeTab !== 'agent' || !list.clientHeight) return;
    state.visible = true;
    state.initialized = true;
    state.top = list.scrollTop;
    state.pinned = list.scrollHeight - list.scrollTop - list.clientHeight <= SCROLL_BOTTOM_THRESHOLD;
  };

  // 切换画布页时丢弃上一页还在路上的回复。
  useEffect(() => () => { requestRef.current += 1; }, [board]);

  const append = (message: Omit<StoredChatMessage, 'id' | 'createdAt'>) => {
    const next = { ...message, id: crypto.randomUUID(), createdAt: Date.now() };
    onMessagesChange((current) => [...current, next]);
    return next.id;
  };

  const placePlan = (messageId: string, plan: AgentPlan) => {
    const ids = onPlacePlan(plan);
    if (ids.length) onMessagesChange((current) => current.map((message) => (message.id === messageId ? { ...message, nodeIds: ids } : message)));
  };

  const submit = async (text = draft) => {
    const request = text.trim();
    if (!request || working) return;
    setDraft('');
    append({ role: 'user', content: request });
    if (!choice.provider || !choice.model) {
      append({ role: 'assistant', tone: 'error', content: '还没有可用的文本模型。请先在设置 → API 与模型中配置文本模型，Agent 会用它来规划节点。' });
      return;
    }
    const ticket = ++requestRef.current;
    setWorking(true);
    try {
      const { nodes } = useCanvasStore.getState();
      const context = nodes
        .filter((node) => isCanvasNodeKind(node.type))
        .map((node) => ({ type: node.type as CanvasNodeKind, title: nodeTitle(node), summary: nodeSummary(node), selected: Boolean(node.selected) }));
      const result = await generateProviderText(choice.provider, buildAgentPrompt(request, { board, nodes: context }), choice.model);
      if (ticket !== requestRef.current) return;
      const { plan, structured } = parseAgentPlan(result.content);
      if (!structured || !plan.nodes.length) {
        append({ role: 'assistant', content: plan.reply });
        return;
      }
      const messageId = append({ role: 'assistant', content: plan.reply, plan });
      if (mode === 'auto') placePlan(messageId, plan);
    } catch (error) {
      if (ticket !== requestRef.current) return;
      append({ role: 'assistant', tone: 'error', content: error instanceof Error && error.message ? error.message : 'Agent 请求失败，请稍后重试。' });
    } finally {
      if (ticket === requestRef.current) setWorking(false);
    }
  };

  const providerGroups = useMemo(() => {
    const groups = new Map<string, ModelOption[]>();
    choice.options.forEach((option) => groups.set(option.provider.name || option.provider.id, [...(groups.get(option.provider.name || option.provider.id) || []), option]));
    return [...groups.entries()];
  }, [choice.options]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="agent"
          variants={dockVariants('right', 24)}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-label="画布 Agent"
          className="canvas-chrome nokey nowheel absolute bottom-0 right-0 top-0 z-40 flex flex-col overflow-hidden text-card-foreground"
          style={{ width: AGENT_PANEL_WIDTH, boxShadow: 'var(--canvas-shadow-lg)', border: 'none' }}
        >
          <header className="flex h-14 shrink-0 items-center gap-2.5 px-4">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-muted">{working ? <ThinkingOrb size={22} /> : <ChatAi size={16} />}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">画布 Agent</div>
              <div className="truncate text-[11px] text-muted-foreground">{working ? <ShimmerText>正在规划「{board}」…</ShimmerText> : `正在操作「${board}」`}</div>
            </div>
            <Tooltip content="收起" shortcut="⌘J" side="bottom">
              <button type="button" className="canvas-icon-button" aria-label="收起画布 Agent" onClick={onClose}><X size={16} /></button>
            </Tooltip>
          </header>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'params' | 'agent')} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 grid w-auto shrink-0 grid-cols-2">
              <TabsTrigger value="params">参数</TabsTrigger>
              <TabsTrigger value="agent">Agent</TabsTrigger>
            </TabsList>
            <TabsContent value="params" forceMount className={cn('min-h-0 flex-1 flex-col overflow-hidden', activeTab === 'params' ? 'flex' : 'hidden')}>
              {selectedNode ? <CanvasNodeParams key={selectedNode.id} {...selectedNode} /> : <CanvasNodeParamsEmpty selectedCount={selectedCount} reason={selectedAnnotation ? 'annotation' : undefined} />}
            </TabsContent>
            <TabsContent value="agent" forceMount className={cn('min-h-0 flex-1 flex-col overflow-hidden', activeTab === 'agent' ? 'flex' : 'hidden')}>
          <div ref={listRef} data-testid="agent-message-list" onScroll={handleListScroll} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {messages.length === 0 ? (
              <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }} className="pt-6">
                <motion.p variants={staggerItem} className="text-sm font-semibold text-foreground">想在画布上做什么？</motion.p>
                <motion.p variants={staggerItem} className="mt-1 text-xs leading-5 text-muted-foreground">描述目标，Agent 会拆成文本、图片、视频节点并连好线。选中节点后提问，Agent 会参考它们。</motion.p>
                <div className="mt-4 space-y-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <motion.button
                      key={suggestion}
                      variants={staggerItem}
                      type="button"
                      onClick={() => void submit(suggestion)}
                      className="flex w-full items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-accent"
                    >
                      <Sparkles size={13} className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">{suggestion}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="space-y-3 pt-1">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={springs.snappy}
                    className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {message.role === 'user' ? (
                      <div className="max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-xs leading-5 text-background">{message.content}</div>
                    ) : (
                      <div className="w-full text-xs leading-5 text-foreground">
                        {message.tone === 'error' ? (
                          <div role="alert" className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
                            <ErrorWarning size={14} className="mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="break-words">{message.content}</p>
                              {/配置|设置/.test(message.content) && (
                                <button type="button" onClick={() => setActiveModule('settings')} className="mt-1 font-medium underline-offset-2 hover:underline">前往设置</button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                        {message.plan && message.plan.nodes.length > 0 && (
                          <PlanCard
                            plan={message.plan}
                            placed={Boolean(message.nodeIds?.length)}
                            onPlace={() => message.plan && placePlan(message.id, message.plan)}
                            onRun={() => message.nodeIds && onRunNodes(message.nodeIds)}
                            onFocus={() => message.nodeIds && onFocusNodes(message.nodeIds)}
                          />
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
                {working && (
                  <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                    <ThinkingOrb size={18} />
                    <ShimmerText>正在理解需求并规划节点…</ShimmerText>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 p-3 pt-0">
            <div className="relative rounded-xl border border-border bg-background focus-within:border-ring">
              <BorderBeam active={working} size={1.5} duration={2.6} />
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                rows={3}
                placeholder="描述你想创建的内容，Enter 发送"
                aria-label="发送给画布 Agent"
                className="canvas-prompt-field block max-h-[160px] min-h-[64px] w-full resize-none bg-transparent px-3 pt-2.5 text-xs leading-5 text-foreground outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label="Agent 模型" className="flex h-7 min-w-0 max-w-[160px] items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent">
                      <span className="truncate">{choice.model || '未配置模型'}</span>
                      <ChevronDown size={12} className="shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" className="w-[240px]">
                    {providerGroups.length ? (
                      <DropdownMenuRadioGroup value={choice.option?.value || ''} onValueChange={(value) => { setStoredModel(value); writeStored(MODEL_KEY, value); }}>
                        {providerGroups.map(([name, options], index) => (
                          <div key={name}>
                            {index > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuLabel>{name}</DropdownMenuLabel>
                            {options.map((option) => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.model}</DropdownMenuRadioItem>)}
                          </div>
                        ))}
                      </DropdownMenuRadioGroup>
                    ) : <DropdownMenuLabel className="py-2 font-normal">还没有可用的文本模型</DropdownMenuLabel>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem icon={Settings} onSelect={() => setActiveModule('settings')}>管理模型</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label="执行方式" className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent">
                      {mode === 'auto' ? '自动放入' : '确认后放入'}
                      <ChevronDown size={12} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" className="w-[220px]">
                    <DropdownMenuRadioGroup value={mode} onValueChange={(value) => { const next = value === 'confirm' ? 'confirm' : 'auto'; setMode(next); writeStored(MODE_KEY, next); }}>
                      <DropdownMenuRadioItem value="auto">自动放入画布</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="confirm">先给方案，确认后放入</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="font-normal leading-4">两种方式都只创建节点，不会自动调用生图或视频。</DropdownMenuLabel>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Tooltip content="发送" shortcut="↵">
                  <button
                    type="button"
                    aria-label="发送"
                    disabled={!draft.trim() || working}
                    onClick={() => void submit()}
                    className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-foreground text-background transition-[transform,opacity] hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-35"
                  >
                    {working ? <ThinkingOrb size={18} /> : <ArrowUp size={16} />}
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
            </TabsContent>
          </Tabs>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
