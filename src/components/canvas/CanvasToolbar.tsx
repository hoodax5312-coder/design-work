import { useState } from 'react';
import { ChatAi, Check, ChevronDown, Film, Focus, Grid, Hand, Image as ImageIcon, Keyboard, LayoutMasonry, Map, MousePointer2, Music, Type, Upload, ZoomIn, ZoomOut } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { motion, springs } from '../motion';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Popover, PopoverAnchor, PopoverContent, Tooltip } from '../ui';
import type { CanvasAnnotationKind, CanvasNodeKind } from './canvasModel';
import { ANNOTATION_CATALOG, NODE_CATALOG } from './nodeCatalog';

const ZOOM_STEPS = [50, 100, 200];

export type CanvasTool = 'select' | 'pan';

interface CanvasRailProps {
  tool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onAdd: (kind: CanvasNodeKind) => void;
  /** 便签直接新建；分组有选中节点时把它们编组，否则新建空画框。 */
  onAddAnnotation: (kind: CanvasAnnotationKind) => void;
  onUpload: () => void;
  onToggleAgent: () => void;
  agentOpen: boolean;
}

/** 下拉箭头：主图标的附属控件，尺寸和对比度都低一级，避免和功能图标抢层级。 */
const RailChevron = () => (
  <ChevronDown size={12} aria-hidden="true" className="shrink-0 opacity-60" />
);

const RailButton = ({ label, shortcut, active, disabled, side = 'top', onClick, children }: { label: string; shortcut?: string; active?: boolean; disabled?: boolean; side?: 'top' | 'bottom'; onClick: () => void; children: React.ReactNode }) => (
  <Tooltip content={label} shortcut={shortcut} side={side}>
    <button type="button" className="canvas-icon-button" aria-label={label} aria-pressed={active} data-active={active || undefined} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  </Tooltip>
);

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
      <div role="group" aria-label="工具选择" className="flex items-center gap-0.5">
        <Tooltip content={current.label} shortcut={current.shortcut} side="bottom" disabled={open}>
          <button
            type="button"
            aria-label={current.label}
            className="canvas-icon-button"
            onClick={() => onToolChange(current.key)}
          >
            <Icon size={16} />
          </button>
        </Tooltip>
        <Tooltip content="切换工具" side="bottom" disabled={open}>
          <PopoverAnchor asChild>
            <button
              type="button"
              aria-label="切换工具"
              aria-expanded={open}
              aria-haspopup="listbox"
              className="canvas-icon-button px-0" style={{ width: 12 }}
              onClick={() => setOpen((v) => !v)}
            >
              <RailChevron />
            </button>
          </PopoverAnchor>
        </Tooltip>
      </div>
      <PopoverContent side="bottom" align="start" sideOffset={14} className="w-44 p-1">
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
                <ItemIcon size={16} />
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

/** 创建类操作仅保留便签与分组。 */
const ActionsSwitcher = ({ onAddAnnotation }: Pick<CanvasRailProps, 'onAddAnnotation'>) => {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<CanvasAnnotationKind>('group');
  const current = ANNOTATION_CATALOG[activeId];
  const Icon = current.icon;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <div role="group" aria-label="创建注释" className="flex items-center gap-0.5">
        <Tooltip content={current.label} side="bottom" disabled={open}>
          <button type="button" aria-label={current.label} className="canvas-icon-button" onClick={() => onAddAnnotation(activeId)}>
            <Icon size={16} />
          </button>
        </Tooltip>
        <Tooltip content="切换操作" side="bottom" disabled={open}>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="切换操作" aria-expanded={open} aria-haspopup="menu" className="canvas-icon-button px-0" style={{ width: 12 }}>
              <RailChevron />
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
      </div>
      <DropdownMenuContent side="bottom" align="start" sideOffset={14} className="w-44 p-1">
        {(['note', 'group'] as const).map((kind) => (
          <DropdownMenuItem key={kind} className="[&>svg]:size-4" icon={ANNOTATION_CATALOG[kind].icon} shortcut={kind === 'note' ? 'N' : '⌘G'} onSelect={() => { setActiveId(kind); onAddAnnotation(kind); setOpen(false); }}>
            {ANNOTATION_CATALOG[kind].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface CanvasViewControlsProps {
  onTidy: () => void;
  onShowShortcuts: () => void;
  zoom: number;
  onFitView: () => void;
  onZoomTo: (value: number) => void;
  snapToGrid: boolean;
  onSnapToGridChange: (value: boolean) => void;
  onToggleMinimap: () => void;
}

/** 底部状态栏：辅助操作靠左、缩放居中、网格和小地图靠右。 */
export const CanvasViewControls = ({ onTidy, onShowShortcuts, zoom, onFitView, onZoomTo, snapToGrid, onSnapToGridChange, onToggleMinimap }: CanvasViewControlsProps) => {
  const showMinimap = useCanvasStore((state) => state.showMinimap);
  return (
    <div role="group" aria-label="画布视图控制" className="canvas-view-controls pointer-events-auto absolute inset-x-0 bottom-0 z-50 grid h-8 grid-cols-[1fr_auto_1fr] items-center px-2">
      <div className="flex items-center gap-1 justify-self-start">
        <RailButton label="整理布局" onClick={onTidy}><LayoutMasonry size={14} /></RailButton>
        <RailButton label="快捷键" shortcut="?" onClick={onShowShortcuts}><Keyboard size={14} /></RailButton>
      </div>
      <div className="flex items-center gap-1 justify-self-center">
        <RailButton label="缩小画布" onClick={() => onZoomTo(Math.max(0.1, zoom / 1.2))} disabled={zoom <= 0.1}><ZoomOut size={14} /></RailButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="画布缩放比例" className="canvas-icon-button w-12 text-xs tabular-nums">{Math.round(zoom * 100)}%</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem icon={Focus} shortcut="⇧1" onSelect={onFitView}>适应画布</DropdownMenuItem>
            <DropdownMenuSeparator />
            {ZOOM_STEPS.map((step) => (
              <DropdownMenuItem key={step} icon={Math.round(zoom * 100) === step ? Check : undefined} className={Math.round(zoom * 100) === step ? undefined : 'pl-[30px]'} onSelect={() => onZoomTo(step / 100)}>{step}%</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <RailButton label="放大画布" onClick={() => onZoomTo(Math.min(3, zoom * 1.2))} disabled={zoom >= 3}><ZoomIn size={14} /></RailButton>
        <RailButton label="适应画布" shortcut="⇧1" onClick={onFitView}><Focus size={14} /></RailButton>
      </div>
      <div className="flex items-center gap-1 justify-self-end">
        <RailButton label="吸附网格" active={snapToGrid} onClick={() => onSnapToGridChange(!snapToGrid)}><Grid size={14} /></RailButton>
        <RailButton label={showMinimap ? '隐藏小地图' : '显示小地图'} active={showMinimap} onClick={onToggleMinimap}><Map size={14} /></RailButton>
      </div>
    </div>
  );
};

/** 画布 Agent：当前只有一种模式，直接开关，不做下拉。 */
const AgentButton = ({ open, onToggleAgent }: { open: boolean; onToggleAgent: () => void }) => (
  <Tooltip content="画布 Agent" shortcut="⌘J" side="bottom">
    <button
      type="button"
      aria-label="画布 Agent"
      aria-pressed={open}
      data-active={open || undefined}
      className="canvas-icon-button"
      onClick={onToggleAgent}
    >
      <ChatAi size={16} />
    </button>
  </Tooltip>
);

/** 顶部居中创建工具栏：工具选择、上传、节点、便签/分组和 Agent。 */
export const CanvasRail = ({ tool, onToolChange, onAdd, onAddAnnotation, onUpload, onToggleAgent, agentOpen }: CanvasRailProps) => {
  const addButtons: Array<{ key: 'upload' | 'video' | 'imageGen' | 'text' | 'audio'; label: string; shortcut: string; Icon: React.ElementType; onClick: () => void }> = [
    { key: 'upload', label: '上传', shortcut: '', Icon: Upload, onClick: onUpload },
    { key: 'text', label: '文本', shortcut: 'T', Icon: Type, onClick: () => onAdd(NODE_CATALOG.text.kind) },
    { key: 'imageGen', label: '图片', shortcut: 'I', Icon: ImageIcon, onClick: () => onAdd(NODE_CATALOG.imageGen.kind) },
    { key: 'video', label: '视频', shortcut: 'M', Icon: Film, onClick: () => onAdd(NODE_CATALOG.video.kind) },
    { key: 'audio', label: '音频', shortcut: 'A', Icon: Music, onClick: () => onAdd(NODE_CATALOG.audio.kind) },
  ];

  return (
    // 相对整个画布居中；定位与内层入场动效分离，避免 transform 相互覆盖。
    /* z-50：操作条是画布上最高层的常驻控件，盖过图层面板(z-20)、Agent 面板(z-40)。 */
    <div className="pointer-events-none absolute left-1/2 top-2 z-50 flex -translate-x-1/2">
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.smooth}
      className="pointer-events-auto max-w-full"
    >
      <div className="canvas-chrome flex h-10 items-center gap-1 rounded-[8px] px-1.5">
        <ToolSwitcher tool={tool} onToolChange={onToolChange} />
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
        {addButtons.map(({ key, label, shortcut, Icon, onClick }) => (
          <RailButton key={key} label={label} side="bottom" shortcut={shortcut || undefined} onClick={onClick}>
            <Icon size={16} />
          </RailButton>
        ))}
        <ActionsSwitcher onAddAnnotation={onAddAnnotation} />
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
        <AgentButton open={agentOpen} onToggleAgent={onToggleAgent} />
      </div>
    </motion.div>
    </div>
  );
};
