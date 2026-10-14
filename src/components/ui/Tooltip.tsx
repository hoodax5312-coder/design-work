import { type ReactElement, type ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';
import '../motion/motion.css';

/** 提供统一的悬停延迟；包在需要提示的区域最外层。 */
export const TooltipProvider = ({ delayDuration = 320, skipDelayDuration = 240, ...props }: TooltipPrimitive.TooltipProviderProps) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />
);

export interface TooltipProps {
  content: ReactNode;
  /** 快捷键提示，显示在说明文字之后。 */
  shortcut?: string;
  side?: TooltipPrimitive.TooltipContentProps['side'];
  align?: TooltipPrimitive.TooltipContentProps['align'];
  sideOffset?: number;
  disabled?: boolean;
  className?: string;
  children: ReactElement;
}

export const Tooltip = ({ content, shortcut, side = 'top', align = 'center', sideOffset = 8, disabled, className, children }: TooltipProps) => {
  if (disabled || !content) return children;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={8}
          className={cn(
            'motion-pop-in z-[140] flex select-none items-center gap-1.5 rounded-md bg-foreground px-2 py-1 text-[11px] font-medium leading-4 text-background shadow-md',
            className,
          )}
          style={{ transformOrigin: 'var(--radix-tooltip-content-transform-origin)' }}
        >
          {content}
          {shortcut && <span className="opacity-60">{shortcut}</span>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};
