import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, MoreHorizontal, Pencil, Plus, SidebarFold, SidebarUnfold, Trash2 } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { AnimatePresence, motion, springs } from '../motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '../ui';
import { isCanvasNodeKind, groupMemberIds, nodeTitle } from './canvasModel';
import { ANNOTATION_CATALOG, NODE_CATALOG } from './nodeCatalog';

export const LAYERS_PANEL_WIDTH = 220;

const PROJECT_EMOJIS = ['😀', '✨', '🌱', '🎨', '🚀', '🧩', '🌈', '🪄', '🐻', '🍀', '🌙', '🔥'];

/** 正在行内改名的对象：项目名，或某个画布页。 */
type RenameTarget = { kind: 'project' } | { kind: 'board'; board: string } | null;

/** 行内改名输入框：Enter / 失焦提交，Esc 取消。 */
const InlineRename = ({ value, label, onCommit, onCancel, className }: { value: string; label: string; className?: string; onCommit: (value: string) => void; onCancel: () => void }) => {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.select(); }, []);
  return (
    <input
      ref={inputRef}
      value={draft}
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') onCommit(draft);
        if (event.key === 'Escape') onCancel();
      }}
      className={cn("canvas-inline-edit nokey h-7 w-full min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground outline-none", className)}
    />
  );
};

/** 节点图标：根据 type 返回对应的 Remix Icon 组件。 */
const NodeIcon = ({ type }: { type?: string }) => {
  if (isCanvasNodeKind(type)) {
    const Icon = NODE_CATALOG[type].icon;
    return <Icon size={13} className="text-muted-foreground" />;
  }
  if (type === 'note') {
    const Icon = ANNOTATION_CATALOG.note.icon;
    return <Icon size={13} className="text-muted-foreground" />;
  }
  if (type === 'group') {
    const Icon = ANNOTATION_CATALOG.group.icon;
    return <Icon size={13} className="text-muted-foreground" />;
  }
  return null;
};

interface CanvasLayersPanelProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onBack?: () => void;
  boards: string[];
  activeBoard: string;
  onSwitchBoard: (board: string) => void;
  onCreateBoard: () => void;
  onRenameBoard: (from: string, to: string) => void;
  onDeleteBoard: (board: string) => void;
}

/**
 * 左侧常驻面板（参考 Figma 左栏）：返回 + 项目（图标 / 名称 / 画布页切换）都收在这一栏里，
 * 不再占用顶部通栏；下半部分是当前画布的节点树。收起时留一个悬浮胶囊用于展开。
 */
export const CanvasLayersPanel = ({
  open,
  onOpen,
  onClose,
  onBack,
  boards,
  activeBoard,
  onSwitchBoard,
  onCreateBoard,
  onRenameBoard,
  onDeleteBoard,
}: CanvasLayersPanelProps) => {
  const nodes = useCanvasStore((state) => state.nodes);
  const activeProject = useProjectStore((state) => state.projects.find((project) => project.id === state.activeProjectId));
  const renameProject = useProjectStore((state) => state.renameProject);
  const setProjectEmoji = useProjectStore((state) => state.setProjectEmoji);
  const updateNode = useCanvasStore((state) => state.updateNode);
  const removeNodes = useCanvasStore((state) => state.removeNodes);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [renaming, setRenaming] = useState<RenameTarget>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const projectName = activeProject?.name || '创作空间';

  const toggleGroup = (id: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 顶层：所有分组节点 + 不在任何分组内的非分组节点；分组内的非分组节点会出现在对应分组的 children 里。
  // 多个分组画框重叠时，节点只归属于按画布顺序最先出现的那一个分组。
  const groupNodes = nodes.filter((node) => node.type === 'group');
  const memberByGroup = new Map<string, string[]>();
  const claimed = new Set<string>();
  groupNodes.forEach((group) => {
    const members: string[] = [];
    groupMemberIds(group, nodes).forEach((id) => {
      if (claimed.has(id)) return;
      claimed.add(id);
      members.push(id);
    });
    memberByGroup.set(group.id, members);
  });
  const topLevel = nodes.filter((node) => node.type === 'group' || !claimed.has(node.id));
  const childrenOf = (groupId: string) => {
    const ids = memberByGroup.get(groupId) || [];
    const set = new Set(ids);
    return nodes.filter((node) => set.has(node.id));
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="layers-panel"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={springs.smooth}
          style={{ width: LAYERS_PANEL_WIDTH, border: 'none' }}
          aria-label="画布与图层"
          className="canvas-chrome canvas-side-panel pointer-events-auto absolute bottom-8 left-0 top-0 z-20 flex flex-col overflow-hidden"
        >
          {/* 标题行：返回 + 项目图标 + 项目名 + 收起 */}
          <div className="flex items-center gap-1 px-2 pb-2 pt-2">
            {onBack && (
              <Tooltip content="返回项目列表" side="bottom">
                <button type="button" className="canvas-icon-button" aria-label="返回项目列表" onClick={onBack}>
                  <ArrowLeft size={16} />
                </button>
              </Tooltip>
            )}
            <Popover open={emojiOpen} onOpenChange={(next) => { setEmojiOpen(next); if (next) setRenaming(null); }}>
              <Tooltip content="更换项目图标" side="bottom" disabled={emojiOpen}>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="更换项目图标" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-base leading-none transition-transform hover:scale-105 active:scale-95">
                    {activeProject?.emoji || '😀'}
                  </button>
                </PopoverTrigger>
              </Tooltip>
              <PopoverContent align="start" side="bottom" className="grid w-[188px] grid-cols-6 gap-1 p-2">
                {PROJECT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`使用 ${emoji} 作为项目图标`}
                    onClick={() => { if (activeProject) setProjectEmoji(activeProject.id, emoji); setEmojiOpen(false); }}
                    className={cn('grid h-7 w-7 place-items-center rounded-md text-base transition-colors hover:bg-accent', activeProject?.emoji === emoji && 'bg-accent')}
                  >
                    {emoji}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {renaming?.kind === 'project' ? (
              <InlineRename
                value={projectName}
                label="项目名称"
                onCancel={() => setRenaming(null)}
                onCommit={(value) => { if (activeProject && value.trim()) renameProject(activeProject.id, value); setRenaming(null); }}
              />
            ) : (
              <Tooltip content="双击重命名" side="bottom">
                <button
                  type="button"
                  onDoubleClick={() => setRenaming({ kind: 'project' })}
                  className="min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left text-xs font-semibold text-foreground"
                >
                  {projectName}
                </button>
              </Tooltip>
            )}

            <Tooltip content="收起面板" side="bottom">
              <button type="button" className="canvas-icon-button" aria-label="收起图层面板" onClick={onClose}>
                <SidebarFold size={16} />
              </button>
            </Tooltip>
          </div>

          <div className="mx-2 h-px bg-border/40" />

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* 画布列表 */}
            <section className="px-2 pb-1 pt-2">
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">画布</span>
                <Tooltip content="新建画布页" side="right">
                  <button type="button" className="canvas-icon-button !h-5 !w-5" aria-label="新建画布页" onClick={onCreateBoard}>
                    <Plus size={11} />
                  </button>
                </Tooltip>
              </div>
              {boards.map((board) => {
                const isActive = board === activeBoard;
                if (renaming?.kind === 'board' && renaming.board === board) {
                  return (
                    <div key={board} className="px-0.5 py-0.5">
                      <InlineRename
                        value={board}
                        label="画布页名称"
                        onCancel={() => setRenaming(null)}
                        onCommit={(value) => { if (value.trim()) onRenameBoard(board, value); setRenaming(null); }}
                      />
                    </div>
                  );
                }
                return (
                  <div
                    key={board}
                    className={cn(
                      'group/board flex items-center gap-0.5 rounded-lg',
                      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={isActive}
                      data-active={isActive || undefined}
                      className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-xs"
                      onClick={() => onSwitchBoard(board)}
                      onDoubleClick={() => setRenaming({ kind: 'board', board })}
                    >
                      {board}
                    </button>
                    <DropdownMenu>
                      <Tooltip content="画布页操作" side="bottom">
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`${board} 的操作`}
                            className="mr-1 grid h-5 w-5 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/board:opacity-100 data-[state=open]:opacity-100"
                          >
                            <MoreHorizontal size={13} />
                          </button>
                        </DropdownMenuTrigger>
                      </Tooltip>
                      <DropdownMenuContent align="start" side="bottom" className="w-[188px]">
                        <DropdownMenuLabel>{board}</DropdownMenuLabel>
                        {!isActive && (
                          <>
                            <DropdownMenuItem onSelect={() => onSwitchBoard(board)}>切换到这一页</DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem icon={Pencil} onSelect={() => window.setTimeout(() => setRenaming({ kind: 'board', board }), 0)}>重命名</DropdownMenuItem>
                        <DropdownMenuItem icon={Trash2} destructive disabled={boards.length <= 1} onSelect={() => onDeleteBoard(board)}>删除</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </section>

            <div className="mx-2 h-px bg-border/40" />

            {/* 节点图层树 */}
            <section className="px-2 pb-2 pt-1">
              <div className="mb-1 px-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">图层</span>
              </div>
              {topLevel.length === 0 ? (
                <p className="px-1 py-2 text-[11px] text-muted-foreground">暂无节点</p>
              ) : (
                topLevel.map((node) => {
                  const isRenaming = renamingNodeId === node.id;
                  const onCommitRename = (value: string) => {
                    const title = value.trim();
                    if (title) updateNode(node.id, { title });
                    setRenamingNodeId(null);
                  };
                  const nodeRow = (children: React.ReactNode) => (
                    <div className="group/layer relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-accent/50">
                      {children}
                      <DropdownMenu>
                        <Tooltip content="节点操作" side="bottom">
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`${nodeTitle(node)} 的操作`}
                              className="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/layer:opacity-100 data-[state=open]:opacity-100"
                            >
                              <MoreHorizontal size={13} />
                            </button>
                          </DropdownMenuTrigger>
                        </Tooltip>
                        <DropdownMenuContent align="start" side="bottom" className="w-[188px]">
                          <DropdownMenuItem icon={Pencil} onSelect={() => window.setTimeout(() => setRenamingNodeId(node.id), 0)}>重命名</DropdownMenuItem>
                          <DropdownMenuItem icon={Trash2} destructive onSelect={() => removeNodes([node.id])}>删除</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );

                  if (isRenaming) {
                    return (
                      <div key={node.id} className="px-2 py-1">
                        <InlineRename
                          value={nodeTitle(node)}
                          label="节点名称"
                          onCancel={() => setRenamingNodeId(null)}
                          onCommit={onCommitRename}
                        />
                      </div>
                    );
                  }

                  if (node.type === 'group') {
                    const expanded = expandedGroups.has(node.id);
                    const children = childrenOf(node.id);
                    return (
                      <div key={node.id}>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent/50"
                          onClick={() => toggleGroup(node.id)}
                        >
                          <ChevronDown
                            size={12}
                            className={cn(
                              'shrink-0 text-muted-foreground transition-transform duration-150',
                              !expanded && '-rotate-90',
                            )}
                          />
                          <span className="grid h-5 w-5 shrink-0 place-items-center">
                            <NodeIcon type={node.type} />
                          </span>
                          <span className="flex-1 truncate text-xs text-foreground">{nodeTitle(node)}</span>
                          {children.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">{children.length}</span>
                          )}
                        </button>
                        {expanded &&
                          children.map((child) => (
                            <div
                              key={child.id}
                              className="group/child flex items-center gap-1.5 rounded-lg py-1.5 pl-8 pr-2 hover:bg-accent/50"
                            >
                              <span className="grid h-5 w-5 shrink-0 place-items-center">
                                <NodeIcon type={child.type} />
                              </span>
                              <span className="flex-1 truncate text-xs text-foreground/80">
                                {nodeTitle(child)}
                              </span>
                              <DropdownMenu>
                                <Tooltip content="节点操作" side="bottom">
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      aria-label={`${nodeTitle(child)} 的操作`}
                                      className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/child:opacity-100 data-[state=open]:opacity-100"
                                    >
                                      <MoreHorizontal size={13} />
                                    </button>
                                  </DropdownMenuTrigger>
                                </Tooltip>
                                <DropdownMenuContent align="start" side="bottom" className="w-[188px]">
                                  <DropdownMenuItem icon={Pencil} onSelect={() => window.setTimeout(() => setRenamingNodeId(child.id), 0)}>重命名</DropdownMenuItem>
                                  <DropdownMenuItem icon={Trash2} destructive onSelect={() => removeNodes([child.id])}>删除</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                      </div>
                    );
                  }
                  return (
                    <div key={node.id}>
                      {nodeRow(
                        <>
                          <span className="grid h-5 w-5 shrink-0 place-items-center">
                            <NodeIcon type={node.type} />
                          </span>
                          <span className="flex-1 truncate text-xs text-foreground">{nodeTitle(node)}</span>
                        </>,
                      )}
                    </div>
                  );
                })
              )}
            </section>
          </div>
        </motion.aside>
      ) : (
        /* 收起态：悬浮胶囊，返回 / 项目标识 / 展开。展开按钮固定在最右，与展开态的收起按钮同位。 */
        <motion.div
          key="layers-pill"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={springs.smooth}
          className="canvas-chrome pointer-events-auto absolute left-2 top-2 z-20 flex h-10 items-center gap-1 rounded-[8px] px-1.5 py-0.5"
          style={{ width: LAYERS_PANEL_WIDTH - 13 }}
        >
          {onBack && (
            <Tooltip content="返回项目列表" side="bottom">
              <button type="button" className="canvas-icon-button" aria-label="返回项目列表" onClick={onBack}>
                <ArrowLeft size={16} />
              </button>
            </Tooltip>
          )}
          <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-base leading-none">
            {activeProject?.emoji || '😀'}
          </span>
          {renaming?.kind === 'project' ? (
            <InlineRename
              value={projectName}
              label="项目名称"
              className="h-8"
              onCancel={() => setRenaming(null)}
              onCommit={(value) => { if (activeProject && value.trim()) renameProject(activeProject.id, value); setRenaming(null); }}
            />
          ) : (
            <Tooltip content="双击重命名" side="bottom">
              <button
                type="button"
                onDoubleClick={() => setRenaming({ kind: 'project' })}
                className="h-8 min-w-0 flex-1 truncate text-left text-xs font-semibold text-foreground"
              >
                {projectName}
              </button>
            </Tooltip>
          )}
          <Tooltip content="展开画布与图层" side="bottom">
            <button type="button" className="canvas-icon-button" aria-label="展开画布与图层" onClick={onOpen}>
              <SidebarUnfold size={16} />
            </button>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
