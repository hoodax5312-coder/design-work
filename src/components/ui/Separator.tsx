import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
export const Separator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }>(({ className, orientation = 'horizontal', ...props }, ref) => <div ref={ref} role='separator' aria-orientation={orientation} className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)} {...props} />);
Separator.displayName = 'Separator';

