import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** 键帽样式的快捷键标注。 */
export const Kbd = ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
  <kbd
    className={cn(
      'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[11px] font-medium leading-none text-muted-foreground',
      className,
    )}
    {...props}
  />
);
