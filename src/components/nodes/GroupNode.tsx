import { memo, useEffect, useRef, useState } from 'react';
import { NodeResizer, NodeToolbar, Position, useInternalNode, useViewport, useStore as useFlowStore, type Node, type NodeProps } from '@xyflow/react';
import { AiGenerate, Artboard, ChevronDown, LayoutGrid, Layers, Lock, SelectAll, Trash2 } from '@/lib/remixIconShim';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, Popover, PopoverTrigger, PopoverContent, Tooltip } from '../ui';
import { groupMemberIds } from '../canvas/canvasModel';
import { useCanvasActions } from '../canvas/canvasContext';
import { describeRunSummary, isNodeRunnable, runNodesInOrder } from '../canvas/generation';
import { NodeActionButtons, NodeMenu, ToolbarDivider, type NodeAction } from './NodeFrame';

type GroupNodeData = { title?: string; locked?: boolean; backgroundColor?: string } & Record<string, unknown>;
type GroupNodeType = Node<GroupNodeData>;
const GROUP_COLORS = [
  { label: '默认', value: '' }, { label: '蓝色', value: '#3B82F6' },
  { label: '绿色', value: '#22C55E' }, { label: '橙色', value: '#F59E0B' },
  { label: '红色', value: '#EF4444' }, { label: '紫色', value: '#A855F7' },
];
const groupButtonClass = 'flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs hover:bg-accent disabled:pointer-events-none disabled:opacity-40';

const membersOf = (id: string) => {
  const { nodes } = useCanvasStore.getState();
  const self = nodes.find((node) => node.id === id);
  return self ? groupMemberIds(self, nodes) : [];
};

/** 分组保存成员 id（旧分组按位置恢复），拖动分组时仍由画布带着成员一起移动。 */
export const GroupNode = memo(({ id, data, selected }: NodeProps<GroupNodeType>) => {
  const single = useCanvasStore((state) => state.selectedNodes.length <= 1);
  const updateNode = useCanvasStore((state) => state.updateNode);
  const selectNodes = useCanvasStore((state) => state.selectNodes);
  const removeNodes = useCanvasStore((state) => state.removeNodes);
  const commit = useCanvasStore((state) => state.commit);
  const undo = useCanvasStore((state) => state.undo);
  const arrangeGroup = useCanvasStore((state) => state.arrangeGroup);
  const hasLockedMembers = useCanvasStore((state) => {
    const self = state.nodes.find((node) => node.id === id);
    const members = new Set(self ? groupMemberIds(self, state.nodes) : []);
    return state.nodes.some((node) => members.has(node.id) && node.data.locked);
  });
  const memberCount = useCanvasStore((state) => {
    const self = state.nodes.find((node) => node.id === id);
    return self ? groupMemberIds(self, state.nodes).length : 0;
  });
  const { notify } = useCanvasActions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const title = String(data.title || '').trim();
  const locked = Boolean(data.locked);
  const viewport = useViewport();
  const internal = useInternalNode(id);
  const screenTop = (internal?.internals.positionAbsolute.y ?? 0) * viewport.zoom + viewport.y;
  const viewHeight = useFlowStore((state) => state.height);
  const screenBottom = screenTop + (internal?.measured.height ?? 0) * viewport.zoom;
  // 顶部空间不够时移到底部；同时避开固定的底部视图操作条。
  const toolbarBelow = screenTop < 110;
  const toolbarOffset = toolbarBelow && screenBottom > viewHeight - 84 ? -56 : 12;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitTitle = () => {
    const next = draft.trim();
    if (next !== title) updateNode(id, { title: next }, { history: true });
    setEditing(false);
  };

  const runMembers = () => {
    const { nodes, edges } = useCanvasStore.getState();
    const members = new Set(membersOf(id));
    const targets = nodes.filter((node) => members.has(node.id) && isNodeRunnable(node, nodes, edges)).map((node) => node.id);
    if (!targets.length) {
      notify('组内没有可运行的节点');
      return;
    }
    notify(`开始运行 ${targets.length} 个节点`);
    void runNodesInOrder(targets).then((summary) => notify(describeRunSummary(summary)));
  };

  const deleteWithMembers = () => {
    const ids = [id, ...membersOf(id)];
    const removed = removeNodes(ids);
    const skipped = ids.length - removed;
    notify(skipped ? `已删除 ${removed} 个节点，跳过 ${skipped} 个锁定节点` : `已删除分组及 ${removed - 1} 个组内节点`, { label: '撤销', run: undo });
  };

  const dissolve = () => {
    if (removeNodes([id])) notify('已解散分组，组内节点保留', { label: '撤销', run: undo });
  };

  const actions: NodeAction[] = [
    { id: 'select', icon: SelectAll, label: '选中组内节点', disabled: !memberCount, onSelect: () => selectNodes(membersOf(id)) },
    { id: 'run', icon: AiGenerate, label: '生成组内节点', disabled: !memberCount, onSelect: runMembers },
  ];

  return (
    <>
      <NodeToolbar isVisible={Boolean(selected) && single} position={toolbarBelow ? Position.Bottom : Position.Top} offset={toolbarOffset} align="center" className="!p-0" style={{ zIndex: 60 }}>
        <div className="canvas-chrome nodrag nopan flex items-center gap-0.5 rounded-lg p-1" onDoubleClick={(event) => event.stopPropagation()}>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={groupButtonClass} disabled={locked} aria-label="分组背景色">
                <span className="h-3.5 w-3.5 rounded-full border border-foreground/30" style={{ backgroundColor: data.backgroundColor || 'var(--muted)' }} />背景色<ChevronDown size={12} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-auto p-3" aria-label="选择分组背景色">
              <div className="flex gap-2">
                {GROUP_COLORS.map((color) => <button key={color.label} type="button" title={color.label} aria-label={`分组背景${color.label}`} aria-pressed={(data.backgroundColor || '') === color.value} className="h-8 w-8 rounded-full border border-foreground/20 outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2 aria-pressed:ring-offset-popover" style={{ backgroundColor: color.value || 'var(--muted)' }} onClick={() => updateNode(id, { backgroundColor: color.value }, { history: true })} />)}
              </div>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button type="button" className={groupButtonClass} disabled={locked || !memberCount || hasLockedMembers} title={hasLockedMembers ? '组内有锁定节点，请先解锁后排列' : '排列组内节点'}><LayoutGrid size={14} />排列<ChevronDown size={12} /></button></DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              <DropdownMenuItem onSelect={() => arrangeGroup(id, 'grid')}>宫格排列</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => arrangeGroup(id, 'horizontal')}>水平排列</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => arrangeGroup(id, 'vertical')}>垂直排列</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" className={groupButtonClass} disabled={locked} onClick={dissolve}><Layers size={14} />解散</button>
          <button type="button" className={groupButtonClass} disabled={locked} onClick={deleteWithMembers} title="删除分组及组内节点"><Trash2 size={14} />删除</button>
          <ToolbarDivider />
          <NodeActionButtons actions={actions} />
          <ToolbarDivider />
          <NodeMenu id={id} locked={locked} deleteLabel="删除分组及组内节点" onDelete={deleteWithMembers}>
            <DropdownMenuItem
              icon={Layers}
              disabled={locked}
              onSelect={dissolve}
            >
              解散分组
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </NodeMenu>
        </div>
      </NodeToolbar>

      <div className="canvas-group" data-selected={selected || undefined} style={/^#[0-9a-f]{6}$/i.test(data.backgroundColor || '') ? { backgroundColor: `${data.backgroundColor}26` } : undefined}>
        <div className="canvas-group-title">
          <Artboard size={13} className="shrink-0" />
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitTitle();
                if (event.key === 'Escape') setEditing(false);
              }}
              aria-label="分组名称"
              className="canvas-inline-edit nodrag nokey h-5 min-w-0 flex-1 rounded border border-border bg-background px-1 text-xs text-foreground outline-none"
            />
          ) : (
            <span
              className="min-w-0 cursor-text truncate"
              data-empty={!title || undefined}
              title="双击重命名"
              onDoubleClick={(event) => {
                event.stopPropagation();
                setDraft(title);
                setEditing(true);
              }}
            >
              {title || '分组'}
            </span>
          )}
          {memberCount > 0 && <span className="canvas-group-count">{memberCount} 个节点</span>}
          {locked && (
            <Tooltip content="已锁定：不可拖动、缩放或删除" side="top">
              <span className="flex shrink-0 items-center"><Lock size={12} /></span>
            </Tooltip>
          )}
        </div>
      </div>

      {selected && !locked && (
        <NodeResizer
          minWidth={200}
          minHeight={140}
          maxWidth={6000}
          maxHeight={6000}
          handleClassName="canvas-resize-handle"
          lineClassName="canvas-resize-line"
          onResizeStart={commit}
        />
      )}
    </>
  );
});

GroupNode.displayName = 'GroupNode';
