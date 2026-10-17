import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Layers, Pencil, Plus, Trash2 } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { useProjectStore } from '../../stores/useProjectStore';
import { motion, springs } from '../motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '../ui';

const PROJECT_EMOJIS = ['😀', '✨', '🌱', '🎨', '🚀', '🧩', '🌈', '🪄', '🐻', '🍀', '🌙', '🔥'];

/** 行内改名输入框：Enter / 失焦提交，Esc 取消。 */
const InlineRename = ({ value, label, onCommit, onCancel }: { value: string; label: string; onCommit: (value: string) => void; onCancel: () => void }) => {
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
      className="nokey h-7 w-[132px] rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground outline-none focus:border-ring"
    />
  );
};

interface CanvasHeaderProps {
  onBack?: () => void;
  boards: string[];
  activeBoard: string;
  onSwitchBoard: (board: string) => void;
  onCreateBoard: () => void;
  onRenameBoard: (from: string, to: string) => void;
  onDeleteBoard: (board: string) => void;
  layersOpen: boolean;
  onToggleLayers: () => void;
}

/** 顶部全宽标题栏：左区（图层切换 + 返回 + 项目 + 画布页）/ 中区 / 右区，参考 Figma 布局。 */
export const CanvasHeader = ({ onBack, boards, activeBoard, onSwitchBoard, onCreateBoard, onRenameBoard, onDeleteBoard, layersOpen, onToggleLayers }: CanvasHeaderProps) => {
  const activeProject = useProjectStore((state) => state.projects.find((project) => project.id === state.activeProjectId));
  const renameProject = useProjectStore((state) => state.renameProject);
  const setProjectEmoji = useProjectStore((state) => state.setProjectEmoji);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [renaming, setRenaming] = useState<'project' | 'board' | null>(null);
  const projectName = activeProject?.name || '创作空间';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.smooth}
      className="canvas-chrome absolute inset-x-0 top-0 z-30 flex h-12 items-center border-b border-border/30 px-2"
    >
      {/* 左区：图层切换 + 分隔 + 返回 + 项目 + 画布页 */}
      <div className="flex items-center gap-0.5">
        <Tooltip content="画布与图层" side="bottom">
          <button type="button" className="canvas-icon-button" aria-label="画布与图层" aria-pressed={layersOpen} data-active={layersOpen || undefined} onClick={onToggleLayers}><Layers size={16} /></button>
        </Tooltip>
        {onBack && (
          <>
            <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
            <Tooltip content="返回项目列表" side="bottom">
              <button type="button" className="canvas-icon-button" aria-label="返回项目列表" onClick={onBack}><ArrowLeft size={16} /></button>
            </Tooltip>
          </>
        )}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <Tooltip content="更换项目图标" side="bottom" disabled={emojiOpen}>
            <PopoverTrigger asChild>
              <button type="button" aria-label="更换项目图标" className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[18px] leading-none transition-transform hover:scale-105 active:scale-95">
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

        {renaming === 'project' ? (
          <InlineRename
            value={projectName}
            label="项目名称"
            onCancel={() => setRenaming(null)}
            onCommit={(value) => { if (activeProject && value.trim()) renameProject(activeProject.id, value); setRenaming(null); }}
          />
        ) : (
          <Tooltip content="双击重命名" side="bottom">
            <button type="button" onDoubleClick={() => setRenaming('project')} className="max-w-[180px] truncate rounded-md px-1.5 py-1 text-xs font-semibold text-foreground">
              {projectName}
            </button>
          </Tooltip>
        )}

        <span aria-hidden="true" className="px-0.5 text-xs text-muted-foreground/60">/</span>

        {renaming === 'board' ? (
          <InlineRename
            value={activeBoard}
            label="画布页名称"
            onCancel={() => setRenaming(null)}
            onCommit={(value) => { onRenameBoard(activeBoard, value); setRenaming(null); }}
          />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="切换画布页" className="flex h-8 max-w-[160px] items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
                <span className="truncate">{activeBoard}</span>
                <ChevronDown size={13} className="shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-[208px]">
              <DropdownMenuLabel>画布页</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activeBoard} onValueChange={onSwitchBoard}>
                {boards.map((board) => <DropdownMenuRadioItem key={board} value={board}>{board}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={Plus} onSelect={onCreateBoard}>新建画布页</DropdownMenuItem>
              <DropdownMenuItem icon={Pencil} onSelect={() => window.setTimeout(() => setRenaming('board'), 0)}>重命名当前页</DropdownMenuItem>
              <DropdownMenuItem icon={Trash2} destructive disabled={boards.length <= 1} onSelect={() => onDeleteBoard(activeBoard)}>删除当前页</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 中区：弹性占位 */}
      <div className="flex-1" />

      {/* 右区：预留扩展位 */}
      <div className="flex flex-1 justify-end" />
    </motion.div>
  );
};
