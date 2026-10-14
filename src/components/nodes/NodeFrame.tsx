import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { Handle, NodeResizeControl, NodeResizer, NodeToolbar, Position } from '@xyflow/react';
import {
  Check,
  Copy,
  ErrorWarning,
  Info,
  Lock,
  MoreHorizontal,
  PlayList,
  Plus,
  SkipForward,
  StopFill,
  Trash2,
  Unlink,
  Unlock,
} from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { BorderBeam, ShimmerText, motion, springs } from '../motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '../ui';
import { nodeTitle, type CanvasNodeKind } from '../canvas/canvasModel';
import { useCanvasActions } from '../canvas/canvasContext';
import { chainRunTargets, describeRunSummary, runNodesInOrder, stopNodeGeneration } from '../canvas/generation';
import { NODE_CATALOG } from '../canvas/nodeCatalog';

export interface NodeAction {
  id: string;
  icon: ElementType;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface NodeFrameProps {
  id: string;
  kind: CanvasNodeKind;
  data: Record<string, unknown>;
  selected: boolean;
  /** free：文本节点自由缩放；width：媒体节点只改宽度，高度跟随画面比例。 */
  resize: 'free' | 'width';
  cardStyle?: CSSProperties;
  cardClassName?: string;
  actions?: NodeAction[];
  /** 选中时显示在节点下方的提示词面板。 */
  panel?: ReactNode;
  children: ReactNode;
}

/** 连续输入只记一步撤销：每次聚焦后的第一次修改前提交一次快照。 */
export const useEditHistory = () => {
  const commit = useCanvasStore((state) => state.commit);
  const dirty = useRef(false);
  return {
    onFocus: () => { dirty.current = false; },
    beforeChange: () => {
      if (dirty.current) return;
      dirty.current = true;
      commit();
    },
  };
};

const useElapsedSeconds = (startedAt: unknown, active: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return active && typeof startedAt === 'number' ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
};

const NodeStatus = ({ data }: { data: Record<string, unknown> }) => {
  const generating = Boolean(data.isGenerating);
  const elapsed = useElapsedSeconds(data.startedAt, generating);
  const error = typeof data.error === 'string' ? data.error : '';
  const notice = typeof data.notice === 'string' ? data.notice : '';

  if (generating) return <ShimmerText className="shrink-0 text-[11px] font-medium">生成中 {elapsed}s</ShimmerText>;
  if (error) {
    return (
      <Tooltip content={error} side="top">
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-destructive"><ErrorWarning size={12} />失败</span>
      </Tooltip>
    );
  }
  if (data.stoppedAt) {
    return (
      <Tooltip content={notice || '已停止'} side="top">
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground"><StopFill size={11} />已停止</span>
      </Tooltip>
    );
  }
  if (notice) {
    return (
      <Tooltip content={notice} side="top">
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"><Info size={12} />注意</span>
      </Tooltip>
    );
  }
  if (data.assetSaved) {
    return (
      <Tooltip content="已保存至资产库" side="top">
        <span className="flex shrink-0 items-center text-muted-foreground"><Check size={12} /></span>
      </Tooltip>
    );
  }
  return null;
};

const NodeLabel = ({ id, kind, data }: { id: string; kind: CanvasNodeKind; data: Record<string, unknown> }) => {
  const updateNode = useCanvasStore((state) => state.updateNode);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = NODE_CATALOG[kind];
  const Icon = meta.icon;
  const title = nodeTitle({ type: kind, data });

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next !== String(data.title || '')) updateNode(id, { title: next || undefined }, { history: true });
    setEditing(false);
  };

  return (
    <div className="canvas-node-label">
      <Icon size={13} className="shrink-0" />
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') setEditing(false);
          }}
          aria-label="节点名称"
          className="nodrag nokey h-5 min-w-0 flex-1 rounded border border-border bg-background px-1 text-xs text-foreground outline-none"
        />
      ) : (
        <span
          className="min-w-0 flex-1 cursor-text truncate"
          title="双击重命名"
          onDoubleClick={(event) => {
            event.stopPropagation();
            setDraft(String(data.title || title));
            setEditing(true);
          }}
        >
          {title}
        </span>
      )}
      {data.locked ? (
        <Tooltip content="已锁定：不可拖动、缩放或删除" side="top">
          <span className="flex shrink-0 items-center text-muted-foreground"><Lock size={12} /></span>
        </Tooltip>
      ) : null}
      <NodeStatus data={data} />
    </div>
  );
};

interface NodeMenuProps {
  id: string;
  locked: boolean;
  /** 生成节点才有链路运行与断开连线。 */
  runnable?: boolean;
  /** 放在通用菜单项之前的节点专属菜单项。 */
  children?: ReactNode;
  /** 替换默认的删除行为与文案，例如分组连同组内节点一起删除。 */
  deleteLabel?: string;
  onDelete?: () => void;
}

/** 节点工具条的"更多"菜单：生成节点、便签与分组共用。 */
export const NodeMenu = ({ id, locked, runnable = false, children, deleteLabel = '删除', onDelete }: NodeMenuProps) => {
  const duplicateNodes = useCanvasStore((state) => state.duplicateNodes);
  const disconnectNodes = useCanvasStore((state) => state.disconnectNodes);
  const removeNodes = useCanvasStore((state) => state.removeNodes);
  const setLocked = useCanvasStore((state) => state.setLocked);
  const hasEdges = useCanvasStore((state) => state.edges.some((edge) => edge.source === id || edge.target === id));
  const { notify } = useCanvasActions();
  const [open, setOpen] = useState(false);

  const runChain = (direction: 'down' | 'up') => {
    const targets = chainRunTargets(id, direction);
    if (!targets.length) {
      notify(direction === 'down' ? '此节点及下游没有可运行的节点' : '此节点及上游没有可运行的节点');
      return;
    }
    notify(`开始运行 ${targets.length} 个节点`);
    void runNodesInOrder(targets).then((summary) => notify(describeRunSummary(summary)));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip content="更多" disabled={open}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="canvas-icon-button" aria-label="更多节点操作"><MoreHorizontal size={15} /></button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" side="top">
        {children}
        {runnable && (
          <>
            <DropdownMenuItem icon={SkipForward} onSelect={() => runChain('down')}>从此处运行</DropdownMenuItem>
            <DropdownMenuItem icon={PlayList} onSelect={() => runChain('up')}>运行到此节点</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem icon={locked ? Unlock : Lock} onSelect={() => setLocked([id], !locked)}>{locked ? '解锁' : '锁定'}</DropdownMenuItem>
        <DropdownMenuItem icon={Copy} shortcut="⌘D" onSelect={() => duplicateNodes([id])}>创建副本</DropdownMenuItem>
        {runnable && <DropdownMenuItem icon={Unlink} disabled={!hasEdges} onSelect={() => disconnectNodes([id])}>断开连线</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={Trash2} shortcut={onDelete ? undefined : '⌫'} destructive disabled={locked} onSelect={() => (onDelete ? onDelete() : removeNodes([id]))}>{deleteLabel}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const ToolbarDivider = () => <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />;

export const NodeActionButtons = ({ actions }: { actions: NodeAction[] }) => (
  <>
    {actions.map((action) => (
      <Tooltip key={action.id} content={action.label} shortcut={action.shortcut}>
        <button type="button" className="canvas-icon-button" aria-label={action.label} disabled={action.disabled} onClick={action.onSelect}>
          <action.icon size={15} />
        </button>
      </Tooltip>
    ))}
  </>
);

export const NodeFrame = ({ id, kind, data, selected, resize, cardStyle, cardClassName, actions = [], panel, children }: NodeFrameProps) => {
  const single = useCanvasStore((state) => state.selectedNodes.length <= 1);
  const commit = useCanvasStore((state) => state.commit);
  const { openPicker } = useCanvasActions();
  const showChrome = selected && single;
  const generating = Boolean(data.isGenerating);
  const locked = Boolean(data.locked);

  const openFromHandle = (side: 'source' | 'target') => (event: React.MouseEvent) => {
    event.stopPropagation();
    openPicker({ x: event.clientX, y: event.clientY }, { connect: { nodeId: id, side } });
  };

  return (
    <>
      <NodeToolbar isVisible={showChrome} position={Position.Top} offset={34} align="center" className="!p-0">
        <div className="canvas-chrome nodrag nopan flex items-center gap-0.5 rounded-lg p-1" onDoubleClick={(event) => event.stopPropagation()}>
          {generating && (
            <>
              <Tooltip content="停止生成">
                <button type="button" className="canvas-icon-button" aria-label="停止生成" onClick={() => stopNodeGeneration(id)}>
                  <StopFill size={14} />
                </button>
              </Tooltip>
              <ToolbarDivider />
            </>
          )}
          <NodeActionButtons actions={actions} />
          {actions.length > 0 && <ToolbarDivider />}
          <NodeMenu id={id} locked={locked} runnable />
        </div>
      </NodeToolbar>

      <NodeLabel id={id} kind={kind} data={data} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springs.bouncy}
        className={cn('canvas-node-card h-full w-full', cardClassName)}
        style={cardStyle}
      >
        <BorderBeam active={generating} size={1.5} duration={2.6} />
        <div className="relative h-full w-full overflow-hidden rounded-[inherit]">{children}</div>
      </motion.div>

      <Handle type="target" position={Position.Left} className="canvas-handle" onClick={openFromHandle('target')} aria-label="添加上游节点" title="拖拽连线或点击添加上游节点">
        <span className="canvas-handle-bubble"><Plus size={14} /></span>
      </Handle>
      <Handle type="source" position={Position.Right} className="canvas-handle" onClick={openFromHandle('source')} aria-label="添加下游节点" title="拖拽连线或点击添加下游节点">
        <span className="canvas-handle-bubble"><Plus size={14} /></span>
      </Handle>

      {selected && !locked && resize === 'free' && (
        <NodeResizer
          minWidth={240}
          minHeight={140}
          maxWidth={960}
          maxHeight={960}
          handleClassName="canvas-resize-handle"
          lineClassName="canvas-resize-line"
          onResizeStart={commit}
        />
      )}
      {selected && !locked && resize === 'width' && (
        <NodeResizeControl
          position="bottom-right"
          resizeDirection="horizontal"
          minWidth={200}
          maxWidth={960}
          className="canvas-resize-handle"
          onResizeStart={commit}
        />
      )}

      {panel}
    </>
  );
};
