import { type ReactNode } from 'react';
import { Upload } from '@/lib/remixIconShim';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Kbd } from '../ui';
import type { CanvasAnnotationKind, CanvasNodeKind } from './canvasModel';
import { ANNOTATION_CATALOG_LIST, NODE_CATALOG_LIST } from './nodeCatalog';

export interface ScreenPoint {
  x: number;
  y: number;
}

/** 以屏幕坐标为锚点的菜单，用于右键菜单与节点选择器。 */
export const AnchoredMenu = ({ point, onClose, label, width = 220, onKeyDown, children }: {
  point: ScreenPoint | null;
  onClose: () => void;
  label: string;
  width?: number;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
}) => (
  <DropdownMenu open={Boolean(point)} onOpenChange={(open) => { if (!open) onClose(); }} modal={false}>
    <DropdownMenuTrigger asChild>
      <span aria-hidden="true" tabIndex={-1} className="pointer-events-none fixed h-px w-px" style={{ left: point?.x ?? -9999, top: point?.y ?? -9999 }} />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      aria-label={label}
      align="start"
      side="bottom"
      sideOffset={4}
      style={{ width }}
      onCloseAutoFocus={(event) => event.preventDefault()}
      onKeyDown={onKeyDown}
    >
      {children}
    </DropdownMenuContent>
  </DropdownMenu>
);

/** 新建节点的选择器：空白处双击、右键、拖出连线后松开或点击节点两侧的 ⊕ 时出现。 */
export const NodePicker = ({ point, title, onPick, onPickAnnotation, onUpload, onClose }: {
  point: ScreenPoint | null;
  title: string;
  onPick: (kind: CanvasNodeKind) => void;
  /** 不传时不显示便签与分组（例如从连线拖出时，标注节点不能连线）。 */
  onPickAnnotation?: (kind: CanvasAnnotationKind) => void;
  onUpload?: () => void;
  onClose: () => void;
}) => (
  <AnchoredMenu
    point={point}
    onClose={onClose}
    label={title}
    width={248}
    onKeyDown={(event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      const match = NODE_CATALOG_LIST.find((item) => item.shortcut.toLowerCase() === key);
      const annotation = onPickAnnotation && ANNOTATION_CATALOG_LIST.find((item) => item.shortcut?.toLowerCase() === key);
      if (!match && !annotation) return;
      event.preventDefault();
      if (match) onPick(match.kind);
      else if (annotation) onPickAnnotation?.(annotation.kind);
      onClose();
    }}
  >
    <DropdownMenuLabel>{title}</DropdownMenuLabel>
    {NODE_CATALOG_LIST.map((item) => (
      <DropdownMenuItem key={item.kind} onSelect={() => onPick(item.kind)} className="h-auto py-1.5">
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-foreground"><item.icon size={15} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-foreground">{item.label}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{item.hint}</span>
          </span>
          <Kbd>{item.shortcut}</Kbd>
        </span>
      </DropdownMenuItem>
    ))}
    {onPickAnnotation && (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>标注</DropdownMenuLabel>
        {ANNOTATION_CATALOG_LIST.map((item) => (
          <DropdownMenuItem key={item.kind} icon={item.icon} shortcut={item.shortcut} onSelect={() => onPickAnnotation(item.kind)}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </>
    )}
    {onUpload && (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={Upload} onSelect={onUpload}>上传图片或视频</DropdownMenuItem>
      </>
    )}
  </AnchoredMenu>
);
