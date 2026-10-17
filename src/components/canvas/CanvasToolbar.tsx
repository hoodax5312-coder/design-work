import { useMemo, useState } from 'react';
import { ChatAi, Hand, Keyboard, LayoutMasonry, MousePointer2, Plus, Search, Upload } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { GooeyDial, motion, springs, type GooeyDialItem } from '../motion';
import { Kbd, Popover, PopoverAnchor, PopoverContent, Tooltip } from '../ui';
import { isCanvasNodeKind, nodeSummary, nodeTitle, type CanvasAnnotationKind, type CanvasNodeKind } from './canvasModel';
import { ANNOTATION_CATALOG, NODE_CATALOG, NODE_CATALOG_LIST } from './nodeCatalog';

export type CanvasTool = 'select' | 'pan';

interface CanvasRailProps {
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onAdd: (kind: CanvasNodeKind) => void;
  /** 便签直接新建；分组有选中节点时把它们编组，否则新建空画框。 */
  onAddAnnotation: (kind: CanvasAnnotationKind) => void;
  onUpload: () => void;
  onTidy: () => void;
  onShowShortcuts: () => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  onFocusNode: (id: string) => void;
  agentOpen: boolean;
  onToggleAgent: () => void;
}

const RailButton = ({ label, shortcut, active, disabled, onClick, children }: { label: string; shortcut?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) => (
  <Tooltip content={label} shortcut={shortcut} side="top">
    <button type="button" className="canvas-icon-button" aria-label={label} aria-pressed={active} data-active={active || undefined} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  </Tooltip>
);

/** 节点搜索：按名称、提示词或内容查找并定位。 */
const NodeSearch = ({ onFocusNode, onClose }: { onFocusNode: (id: string) => void; onClose: () => void }) => {
  const nodes = useCanvasStore((state) => state.nodes);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return nodes
      .filter((node) => isCanvasNodeKind(node.type))
      .map((node) => ({ id: node.id, kind: node.type as CanvasNodeKind, title: nodeTitle(node), summary: nodeSummary(node, 48) }))
      .filter((item) => !term || `${item.title} ${item.summary}`.toLowerCase().includes(term));
  }, [nodes, query]);
  const active = Math.min(cursor, Math.max(results.length - 1, 0));

  const pick = (id?: string) => {
    if (!id) return;
    onFocusNode(id);
    onClose();
  };

  return (
    <div className="flex max-h-[min(420px,70vh)] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 pb-2 pt-1">
        <Search size={14} className="shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(event) => { setQuery(event.target.value); setCursor(0); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setCursor((value) => Math.min(value + 1, results.length - 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setCursor((value) => Math.max(value - 1, 0)); }
            if (event.key === 'Enter') { event.preventDefault(); pick(results[active]?.id); }
          }}
          placeholder="搜索节点名称或内容"
          aria-label="搜索节点"
          className="h-7 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Kbd>⌘F</Kbd>
      </div>
      <div role="listbox" aria-label="节点" className="min-h-0 flex-1 overflow-y-auto p-1">
        {results.length ? results.map((item, index) => {
          const Icon = NODE_CATALOG[item.kind].icon;
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setCursor(index)}
              onClick={() => pick(item.id)}
              className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left', index === active && 'bg-accent text-accent-foreground')}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-muted text-foreground"><Icon size={13} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{item.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{item.summary || '暂无内容'}</span>
              </span>
            </button>
          );
        }) : (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{nodes.length ? '没有匹配的节点' : '画布上还没有节点'}</p>
        )}
      </div>
    </div>
  );
};

const TOOL_ITEMS: Array<{ key: CanvasTool; label: string; shortcut: string; Icon: React.ComponentType<{ size?: number | string; className?: string }> }> = [
  { key: 'select', label: '移动', shortcut: 'V', Icon: MousePointer2 },
  { key: 'pan', label: '抓手', shortcut: 'H / 空格', Icon: Hand },
];

/** 工具选择器：当前工具图标 + 小箭头展开列表。 */
const ToolSwitcher = ({ tool, onToolChange }: Pick<CanvasRailProps, 'tool' | 'onToolChange'>) => {
  const [open, setOpen] = useState(false);
  const current = TOOL_ITEMS.find((item) => item.key === tool) ?? TOOL_ITEMS[0];
  const { Icon } = current;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div role="group" aria-label="工具选择" className="flex items-center">
        <Tooltip content={current.label} shortcut={current.shortcut} side="top" disabled={open}>
          <button
            type="button"
            aria-label={current.label}
            aria-pressed
            data-active
            className="canvas-icon-button rounded-r-none border-r border-border/40"
            onClick={() => onToolChange(current.key)}
          >
            <Icon size={16} />
          </button>
        </Tooltip>
        <Tooltip content="切换工具" side="top" disabled={open}>
          <PopoverAnchor asChild>
            <button
              type="button"
              aria-label="切换工具"
              aria-expanded={open}
              aria-haspopup="listbox"
              className="canvas-icon-button w-5 rounded-l-none px-0"
              onClick={() => setOpen((v) => !v)}
            >
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none" aria-hidden="true" className="shrink-0">
                <path d="M1 1.5L4 4.5L7 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </PopoverAnchor>
        </Tooltip>
      </div>
      <PopoverContent side="top" align="start" sideOffset={14} className="w-44 p-1">
        <div role="listbox" aria-label="工具">
          {TOOL_ITEMS.map(({ key, label, shortcut, Icon: ItemIcon }) => (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={tool === key}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left',
                tool === key ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
              )}
              onClick={() => { onToolChange(key); setOpen(false); }}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center">
                <ItemIcon size={14} />
              </span>
              <span className="flex-1 text-xs font-medium">{label}</span>
              <span className="text-[11px] text-muted-foreground">{shortcut}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

/** 底部居中横向工具栏（参考 Figma）：新建（黏性拨盘）、选择/抓手、上传、搜索、整理、快捷键、撤销/重做与 Agent。 */
export const CanvasRail = ({ tool, onToolChange, onAdd, onAddAnnotation, onUpload, onTidy, onShowShortcuts, searchOpen, onSearchOpenChange, onFocusNode, agentOpen, onToggleAgent }: CanvasRailProps) => {
  const NoteIcon = ANNOTATION_CATALOG.note.icon;
  const GroupIcon = ANNOTATION_CATALOG.group.icon;
  const [dialOpen, setDialOpen] = useState(false);
  const dialItems: GooeyDialItem[] = [
    ...NODE_CATALOG_LIST.map((item) => ({ id: item.kind, label: item.label, icon: item.icon, shortcut: item.shortcut, onSelect: () => onAdd(item.kind) })),
    { id: 'upload', label: '上传', icon: Upload, onSelect: onUpload },
  ];

  return (
    // 外层只负责定位：画布底部水平居中。
    // 动效放在内层，framer-motion 的行内 transform 会覆盖 Tailwind 的 translate 类。
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 justify-center">
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.smooth}
      className="pointer-events-auto max-w-full"
    >
      <div className="canvas-chrome flex items-center gap-1 rounded-2xl p-1.5">
        <Tooltip content="添加节点" side="top" disabled={dialOpen}>
          <span className="inline-flex">
            <GooeyDial items={dialItems} open={dialOpen} onOpenChange={setDialOpen} label="添加节点" icon={Plus} size={36} itemSize={34} gap={14} direction="up" />
          </span>
        </Tooltip>
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
        <ToolSwitcher tool={tool} onToolChange={onToolChange} />
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
        <RailButton label="便签" shortcut="N" onClick={() => onAddAnnotation('note')}><NoteIcon size={16} /></RailButton>
        <RailButton label="分组：编组所选，或新建空画框" shortcut="⌘G" onClick={() => onAddAnnotation('group')}><GroupIcon size={16} /></RailButton>
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
        <RailButton label="上传图片或视频" onClick={onUpload}><Upload size={16} /></RailButton>
        <Popover open={searchOpen} onOpenChange={onSearchOpenChange}>
          <PopoverAnchor asChild>
            <span className="inline-flex">
              <RailButton label="搜索节点" shortcut="⌘F" active={searchOpen} onClick={() => onSearchOpenChange(!searchOpen)}><Search size={16} /></RailButton>
            </span>
          </PopoverAnchor>
          <PopoverContent side="top" align="center" sideOffset={14} className="w-[300px] p-0 pt-2">
            <NodeSearch onFocusNode={onFocusNode} onClose={() => onSearchOpenChange(false)} />
          </PopoverContent>
        </Popover>
        <RailButton label="整理布局" onClick={onTidy}><LayoutMasonry size={16} /></RailButton>
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
        <RailButton label="快捷键" shortcut="?" onClick={onShowShortcuts}><Keyboard size={16} /></RailButton>
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
        <Tooltip content="画布 Agent" shortcut="⌘J" side="top">
          <button
            type="button"
            aria-label={agentOpen ? '关闭画布 Agent' : '打开画布 Agent'}
            aria-pressed={agentOpen}
            data-active={agentOpen || undefined}
            onClick={onToggleAgent}
            className="canvas-icon-button !inline-flex !w-auto items-center gap-1.5 px-2.5 text-xs font-semibold"
          >
            <ChatAi size={16} />
            Agent
          </button>
        </Tooltip>
      </div>
    </motion.div>
    </div>
  );
};
