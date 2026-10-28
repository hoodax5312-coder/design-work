// Adapted from satnaing/shadcn-admin src/components/layout/main.tsx (MIT).
// Pinned source and license: THIRD_PARTY_NOTICES.md.
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type MainProps = HTMLAttributes<HTMLElement> & { fixed?: boolean; fluid?: boolean };

export function AdminMain({ fixed, className, fluid, ...props }: MainProps) {
  return (
    <main
      id="admin-main"
      tabIndex={-1}
      data-layout={fixed ? 'fixed' : 'auto'}
      className={cn(
        'px-4 py-6 outline-none sm:px-6',
        fixed && 'flex grow flex-col overflow-hidden',
        !fluid && 'mx-auto w-full max-w-7xl',
        className,
      )}
      {...props}
    />
  );
}
