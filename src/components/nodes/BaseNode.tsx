import { type ElementType, type ReactNode } from 'react';
import { Handle, NodeResizer, Position } from '@xyflow/react';
import { Copy, Trash2 } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { Button } from '../ui';

export type NodeTheme = 'indigo' | 'purple' | 'pink' | 'blue' | 'green' | 'orange';

export interface BaseNodeProps {
  children: ReactNode;
  selected?: boolean;
  theme?: NodeTheme;
  icon: ElementType;
  title: string;
  width?: number;
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;
  onCopy?: () => void;
  onDelete?: () => void;
  className?: string;
  headerExtra?: ReactNode;
}

export function BaseNode({
  children,
  selected = false,
  icon: Icon,
  title,
  width = 400,
  showSourceHandle = true,
  showTargetHandle = false,
  onCopy,
  onDelete,
  className,
  headerExtra,
}: BaseNodeProps) {
  return (
    <div className="group relative">
      {showTargetHandle && <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-2 !border-background !bg-muted-foreground" />}
      <article
        style={{ width }}
        className={cn(
          'overflow-hidden rounded-lg border bg-card text-card-foreground shadow-md transition-[border-color,box-shadow,transform] duration-150',
          selected
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-border hover:border-muted-foreground/40',
          className,
        )}
      >
        {selected && (
          <NodeResizer
            isVisible
            minWidth={280}
            minHeight={180}
            lineClassName="!border-primary/60"
            handleClassName="!h-2 !w-2 !border-2 !border-background !bg-primary"
          />
        )}
        <header className="flex h-10 items-center justify-between px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Icon size={13} /></span>
            <span className="truncate text-xs font-semibold">{title}</span>
          </div>
          <div className="flex items-center gap-1">
            {headerExtra}
            <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {onCopy && <Button type="button" variant="ghost" size="iconSm" onClick={onCopy} aria-label="复制节点" className="h-7 w-7"><Copy size={13} /></Button>}
              {onDelete && <Button type="button" variant="ghost" size="iconSm" onClick={onDelete} aria-label="删除节点" className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={13} /></Button>}
            </div>
          </div>
        </header>
        <div>{children}</div>
      </article>
      {showSourceHandle && <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-2 !border-background !bg-primary" />}
    </div>
  );
}

export const themeConfigs = {};
