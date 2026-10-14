import { Fragment, useState, type ElementType } from 'react';
import { NodeToolbar, Position } from '@xyflow/react';
import {
  AiGenerate,
  AlignBottom,
  AlignCenterH,
  AlignCenterV,
  AlignLeft,
  AlignRight,
  AlignTop,
  Artboard,
  ChatAi,
  Copy,
  DistributeH,
  DistributeV,
  LayoutMasonry,
  Lock,
  StopFill,
  Trash2,
  Unlink,
  Unlock,
  Upload,
} from '@/lib/remixIconShim';
import { AnimatePresence, motion, popVariants, springs, staggerItem, staggerParent } from '../motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Kbd,
  Tooltip,
} from '../ui';
import type { AlignMode, CanvasNodeKind } from './canvasModel';
import { NODE_CATALOG_LIST } from './nodeCatalog';

/* ---------- 多选工具条 ---------- */

export interface AlignAction {
  mode: AlignMode;
  label: string;
  icon: ElementType;
  /** 与 Figma 一致的 ⌥ 快捷键，按 KeyboardEvent.code 匹配（⌥ 会改变 macOS 上的 key）。 */
  code: string;
  shift?: boolean;
  shortcut: string;
}

export const ALIGN_ACTIONS: AlignAction[] = [
  { mode: 'left', label: '左对齐', icon: AlignLeft, code: 'KeyA', shortcut: '⌥A' },
  { mode: 'hcenter', label: '水平居中', icon: AlignCenterH, code: 'KeyH', shortcut: '⌥H' },
  { mode: 'right', label: '右对齐', icon: AlignRight, code: 'KeyD', shortcut: '⌥D' },
  { mode: 'top', label: '顶部对齐', icon: AlignTop, code: 'KeyW', shortcut: '⌥W' },
  { mode: 'vcenter', label: '垂直居中', icon: AlignCenterV, code: 'KeyV', shortcut: '⌥V' },
  { mode: 'bottom', label: '底部对齐', icon: AlignBottom, code: 'KeyS', shortcut: '⌥S' },
  { mode: 'hdistribute', label: '水平均分', icon: DistributeH, code: 'KeyH', shift: true, shortcut: '⌥⇧H' },
  { mode: 'vdistribute', label: '垂直均分', icon: DistributeV, code: 'KeyV', shift: true, shortcut: '⌥⇧V' },
];

/** 均分至少需要三个可移动的节点。 */
export const isDistributeMode = (mode: AlignMode) => mode === 'hdistribute' || mode === 'vdistribute';

const AlignMenu = ({ count, onAlign }: { count: number; onAlign: (mode: AlignMode) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip content="对齐与均分" disabled={open}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="canvas-icon-button" aria-label="对齐与均分" data-active={open || undefined}><AlignLeft size={15} /></button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="center" side="top" className="w-[184px]">
        {ALIGN_ACTIONS.map((action, index) => (
          <Fragment key={action.mode}>
            {(index === 3 || index === 6) && <DropdownMenuSeparator />}
            <DropdownMenuItem
              icon={action.icon}
              shortcut={action.shortcut}
              disabled={isDistributeMode(action.mode) && count < 3}
              onSelect={() => onAlign(action.mode)}
            >
              {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const SelectionToolbar = ({
  ids,
  runnable,
  generating,
  allLocked,
  onRun,
  onStop,
  onAlign,
  onGroup,
  onToggleLock,
  onTidy,
  onDuplicate,
  onDisconnect,
  onDelete,
}: {
  ids: string[];
  runnable: number;
  /** 所选节点中正在生成的数量。 */
  generating: number;
  allLocked: boolean;
  onRun: () => void;
  onStop: () => void;
  onAlign: (mode: AlignMode) => void;
  onGroup: () => void;
  onToggleLock: () => void;
  onTidy: () => void;
  onDuplicate: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
}) => (
  <NodeToolbar nodeId={ids} isVisible={ids.length > 1} position={Position.Top} offset={34} className="!p-0">
    <div className="canvas-chrome nodrag nopan flex items-center gap-0.5 rounded-lg p-1">
      <span className="px-2 text-xs font-medium tabular-nums text-muted-foreground">已选 {ids.length} 个</span>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
      <Tooltip content={runnable ? `按连线顺序生成 ${runnable} 个节点` : '所选节点都还没有提示词'} shortcut="⌘↵">
        <button type="button" className="flex h-8 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-xs font-medium text-background transition-opacity disabled:opacity-40" disabled={!runnable} onClick={onRun}>
          <AiGenerate size={14} />全部生成
        </button>
      </Tooltip>
      {generating > 0 && (
        <Tooltip content="只在本地取消请求，供应商侧可能仍会完成并计费">
          <button type="button" className="flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent" onClick={onStop}>
            <StopFill size={13} />停止 {generating} 个
          </button>
        </Tooltip>
      )}
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
      <AlignMenu count={ids.length} onAlign={onAlign} />
      <Tooltip content="编组" shortcut="⌘G"><button type="button" className="canvas-icon-button" aria-label="编组" onClick={onGroup}><Artboard size={15} /></button></Tooltip>
      <Tooltip content={allLocked ? '解锁' : '锁定'}>
        <button type="button" className="canvas-icon-button" aria-label={allLocked ? '解锁所选节点' : '锁定所选节点'} onClick={onToggleLock}>
          {allLocked ? <Unlock size={15} /> : <Lock size={15} />}
        </button>
      </Tooltip>
      <Tooltip content="整理布局"><button type="button" className="canvas-icon-button" aria-label="整理布局" onClick={onTidy}><LayoutMasonry size={15} /></button></Tooltip>
      <Tooltip content="创建副本" shortcut="⌘D"><button type="button" className="canvas-icon-button" aria-label="创建副本" onClick={onDuplicate}><Copy size={15} /></button></Tooltip>
      <Tooltip content="断开连线"><button type="button" className="canvas-icon-button" aria-label="断开连线" onClick={onDisconnect}><Unlink size={15} /></button></Tooltip>
      <Tooltip content="删除" shortcut="⌫"><button type="button" className="canvas-icon-button hover:!text-destructive" aria-label="删除所选节点" onClick={onDelete}><Trash2 size={15} /></button></Tooltip>
    </div>
  </NodeToolbar>
);

/* ---------- 空画布引导 ---------- */

export const CanvasEmptyState = ({ onAdd, onUpload, onOpenAgent }: { onAdd: (kind: CanvasNodeKind) => void; onUpload: () => void; onOpenAgent: () => void }) => (
  <motion.div
    variants={staggerParent}
    initial="hidden"
    animate="visible"
    exit={{ opacity: 0, transition: { duration: 0.12 } }}
    className="pointer-events-none absolute inset-0 z-10 grid place-items-center"
  >
    <div className="pointer-events-auto flex flex-col items-center text-center">
      <motion.p variants={staggerItem} className="text-sm font-semibold text-foreground">从一个节点开始</motion.p>
      <motion.p variants={staggerItem} className="mt-1.5 text-xs text-muted-foreground">双击空白处添加节点，拖入图片或视频，或让 Agent 规划整条流程</motion.p>
      <motion.div variants={staggerItem} className="mt-5 flex flex-wrap justify-center gap-2">
        {NODE_CATALOG_LIST.map((item) => (
          <motion.button
            key={item.kind}
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={springs.snappy}
            onClick={() => onAdd(item.kind)}
            className="canvas-chrome flex w-[132px] flex-col items-start gap-3 rounded-xl p-3 text-left"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted text-foreground"><item.icon size={16} /></span>
            <span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">{item.label}<Kbd className="h-4 min-w-4 text-[10px]">{item.shortcut}</Kbd></span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{item.hint}</span>
            </span>
          </motion.button>
        ))}
      </motion.div>
      <motion.div variants={staggerItem} className="mt-3 flex items-center gap-2">
        <button type="button" onClick={onUpload} className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"><Upload size={14} />上传素材</button>
        <button type="button" onClick={onOpenAgent} className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"><ChatAi size={14} />让 Agent 规划</button>
      </motion.div>
    </div>
  </motion.div>
);

/* ---------- 拖入文件 ---------- */

export const DropOverlay = ({ visible }: { visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        className="pointer-events-none absolute inset-3 z-[60] grid place-items-center rounded-2xl border-2 border-dashed border-foreground/30 bg-background/60 backdrop-blur-[2px]"
      >
        <motion.div variants={popVariants} initial="hidden" animate="visible" className="canvas-chrome flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-foreground">
          <Upload size={16} />松开以放入画布
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ---------- 提示条 ---------- */

export interface CanvasToastState {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export const CanvasToast = ({ toast, onDismiss }: { toast: CanvasToastState | null; onDismiss: () => void }) => (
  <div className="pointer-events-none absolute bottom-5 left-1/2 z-[70] -translate-x-1/2">
    <AnimatePresence mode="wait">
      {toast && (
        <motion.div
          key={toast.id}
          role="status"
          variants={popVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="pointer-events-auto flex items-center gap-3 rounded-full bg-foreground py-2 pl-4 pr-2 text-xs font-medium text-background shadow-lg"
        >
          <span className="max-w-[360px] truncate">{toast.message}</span>
          {toast.action ? (
            <button type="button" onClick={() => { toast.action?.run(); onDismiss(); }} className="rounded-full bg-background/15 px-2.5 py-1 font-semibold transition-colors hover:bg-background/25">
              {toast.action.label}
            </button>
          ) : <span className="w-1" />}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

/* ---------- 媒体预览 ---------- */

export const MediaLightbox = ({ media, onClose }: { media: { kind: 'image' | 'video'; url: string; title: string } | null; onClose: () => void }) => (
  <Dialog open={Boolean(media)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[92vh] w-auto max-w-[min(1200px,92vw)] gap-3 border-0 bg-transparent p-0 shadow-none" overlayClassName="bg-black/70 backdrop-blur-sm">
      <DialogTitle className="sr-only">{media?.title || '预览'}</DialogTitle>
      <DialogDescription className="sr-only">按 Esc 关闭预览</DialogDescription>
      {media?.kind === 'image' && <img src={media.url} alt={media.title} className="max-h-[86vh] max-w-full rounded-lg object-contain" />}
      {media?.kind === 'video' && <video src={media.url} controls autoPlay className="max-h-[86vh] max-w-full rounded-lg bg-black" />}
      <p className="text-center text-xs text-white/70">{media?.title}</p>
    </DialogContent>
  </Dialog>
);

/* ---------- 快捷键 ---------- */

const SHORTCUT_GROUPS: Array<{ title: string; items: Array<[string, string[]]> }> = [
  { title: '工具', items: [['选择', ['V']], ['抓手', ['H']], ['临时拖动画布', ['空格', '拖动']], ['框选', ['拖动空白处']]] },
  { title: '节点', items: [['新建文本 / 图片 / 视频', ['T', 'I', 'M']], ['新建便签', ['N']], ['生成所选节点', ['⌘', '↵']], ['创建副本', ['⌘', 'D']], ['删除（锁定节点会跳过）', ['⌫']], ['重命名', ['双击标题']]] },
  { title: '编辑', items: [['撤销', ['⌘', 'Z']], ['重做', ['⇧', '⌘', 'Z']], ['全选', ['⌘', 'A']], ['复制 / 剪切 / 粘贴', ['⌘', 'C / X / V']], ['取消选择', ['Esc']]] },
  { title: '编排', items: [['编组所选', ['⌘', 'G']], ['解散所选分组', ['⇧', '⌘', 'G']], ['锁定 / 解锁所选', ['⇧', '⌘', 'L']], ['左 / 右 / 顶 / 底对齐', ['⌥', 'A / D / W / S']], ['水平 / 垂直居中', ['⌥', 'H / V']], ['水平 / 垂直均分', ['⌥', '⇧', 'H / V']]] },
  { title: '视图', items: [['适应画布', ['⇧', '1']], ['缩放到 100%', ['⇧', '0']], ['放大 / 缩小', ['⌘', '= / −']], ['搜索节点', ['⌘', 'F']], ['画布 Agent', ['⌘', 'J']]] },
];

export const ShortcutsDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-[640px] gap-5 rounded-xl p-6">
      <div>
        <DialogTitle className="text-base">快捷键</DialogTitle>
        <DialogDescription className="mt-1 text-xs">在 Windows 上将 ⌘ 换成 Ctrl。</DialogDescription>
      </div>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-[11px] font-medium text-muted-foreground">{group.title}</h3>
            <ul className="space-y-1.5">
              {group.items.map(([label, keys]) => (
                <li key={label} className="flex items-center justify-between gap-3 text-xs text-foreground">
                  <span>{label}</span>
                  <span className="flex shrink-0 items-center gap-1">{keys.map((key) => <Kbd key={key} className="px-1.5">{key}</Kbd>)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
