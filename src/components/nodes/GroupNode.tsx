import { memo, useEffect, useRef, useState } from 'react';
import { NodeResizer, NodeToolbar, Position, type Node, type NodeProps } from '@xyflow/react';
import { AiGenerate, Artboard, Layers, Lock, SelectAll } from '@/lib/remixIconShim';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { DropdownMenuItem, DropdownMenuSeparator, Tooltip } from '../ui';
import { groupMemberIds } from '../canvas/canvasModel';
import { useCanvasActions } from '../canvas/canvasContext';
import { describeRunSummary, isNodeRunnable, runNodesInOrder } from '../canvas/generation';
import { NodeActionButtons, NodeMenu, ToolbarDivider, type NodeAction } from './NodeFrame';

type GroupNodeData = { title?: string; locked?: boolean } & Record<string, unknown>;
type GroupNodeType = Node<GroupNodeData>;

const membersOf = (id: string) => {
  const { nodes } = useCanvasStore.getState();
  const self = nodes.find((node) => node.id === id);
  return self ? groupMemberIds(self, nodes) : [];
};

/** 分组：半透明画框，按位置收纳节点（不使用 parentId），拖动时由画布带着组内节点一起移动。 */
export const GroupNode = memo(({ id, data, selected }: NodeProps<GroupNodeType>) => {
  const single = useCanvasStore((state) => state.selectedNodes.length <= 1);
  const updateNode = useCanvasStore((state) => state.updateNode);
  const selectNodes = useCanvasStore((state) => state.selectNodes);
  const removeNodes = useCanvasStore((state) => state.removeNodes);
  const commit = useCanvasStore((state) => state.commit);
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
    notify(skipped ? `已删除 ${removed} 个节点，跳过 ${skipped} 个锁定节点` : `已删除分组及 ${removed - 1} 个组内节点`);
  };

  const actions: NodeAction[] = [
    { id: 'select', icon: SelectAll, label: '选中组内节点', disabled: !memberCount, onSelect: () => selectNodes(membersOf(id)) },
    { id: 'run', icon: AiGenerate, label: '生成组内节点', disabled: !memberCount, onSelect: runMembers },
  ];

  return (
    <>
      <NodeToolbar isVisible={Boolean(selected) && single} position={Position.Top} offset={12} align="center" className="!p-0">
        <div className="canvas-chrome nodrag nopan flex items-center gap-0.5 rounded-lg p-1" onDoubleClick={(event) => event.stopPropagation()}>
          <NodeActionButtons actions={actions} />
          <ToolbarDivider />
          <NodeMenu id={id} locked={locked} deleteLabel="删除分组及组内节点" onDelete={deleteWithMembers}>
            <DropdownMenuItem
              icon={Layers}
              disabled={locked}
              onSelect={() => {
                if (removeNodes([id])) notify('已解散分组，组内节点保留');
              }}
            >
              解散分组
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </NodeMenu>
        </div>
      </NodeToolbar>

      <div className="canvas-group" data-selected={selected || undefined}>
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
              className="nodrag nokey h-5 min-w-0 flex-1 rounded border border-border bg-background px-1 text-xs text-foreground outline-none"
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
