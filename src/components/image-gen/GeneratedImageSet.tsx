import type { MouseEvent as ReactMouseEvent } from 'react';
import { ErrorWarning } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';

interface SetImageInteractions {
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
}

const DEFAULT_RATIO = 4 / 3;

const savedBadgeClassName = 'pointer-events-none absolute left-2 top-2 z-20 inline-flex h-5 items-center rounded bg-black/55 px-1.5 text-[11px] font-medium leading-none text-white backdrop-blur-sm';
const thumbClassName = 'relative size-10 shrink-0 overflow-hidden rounded-md bg-[#0b0b0b] dark:border dark:border-white/10';

/**
 * Multiple outputs of one generation: the active image is shown at the single-image size,
 * and a strip of small thumbnails underneath switches it. Pending and failed slots stay in the strip.
 */
export const GeneratedImageSet = ({
  images,
  alt,
  activeUrl,
  onActivate,
  selected,
  pendingCount = 0,
  failedCount = 0,
  savedUrls,
  ratios,
  onRatioChange,
  interactions,
}: {
  images: string[];
  alt: string;
  activeUrl?: string;
  onActivate: (url: string) => void;
  selected?: boolean;
  pendingCount?: number;
  failedCount?: number;
  savedUrls: Set<string>;
  ratios: Record<string, number>;
  onRatioChange: (url: string, ratio: number) => void;
  interactions: (url: string) => SetImageInteractions;
}) => {
  const active = activeUrl && images.includes(activeUrl) ? activeUrl : images[0];
  const total = images.length + pendingCount + failedCount;

  return (
    <div className="mx-2">
      {active ? (
        <div
          {...interactions(active)}
          className={cn(
            'group relative flex max-h-[680px] min-h-[240px] cursor-default items-center justify-center overflow-hidden rounded-lg bg-[#0b0b0b] transition-shadow',
            selected && 'ring-2 ring-inset ring-foreground',
          )}
          style={{ aspectRatio: ratios[active] || DEFAULT_RATIO }}
        >
          <button type="button" aria-label={`选择第 ${images.indexOf(active) + 1} 张图片（双击全屏，右键更多操作）`} aria-pressed={selected} className="flex max-h-full min-w-0 max-w-full items-center justify-center self-stretch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <img
              src={active}
              alt={alt}
              draggable={false}
              onLoad={(event) => onRatioChange(active, Math.max(DEFAULT_RATIO, event.currentTarget.naturalWidth / event.currentTarget.naturalHeight))}
              className="h-auto max-h-full max-w-full object-contain"
            />
          </button>
          {savedUrls.has(active) && <span className={savedBadgeClassName}>已收藏</span>}
        </div>
      ) : (
        <div className="flex min-h-[240px] animate-pulse items-center justify-center rounded-lg bg-[#0b0b0b]/[0.06] dark:bg-white/[0.06]" style={{ aspectRatio: DEFAULT_RATIO }} aria-label="正在生成" />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={`本次生成的 ${total} 张图片`}>
        {images.map((url, index) => {
          const isActive = url === active;
          const { onClick, ...rest } = interactions(url);
          return (
            <button
              key={url}
              type="button"
              {...rest}
              onClick={() => { onActivate(url); onClick(); }}
              aria-label={`查看第 ${index + 1} 张`}
              aria-current={isActive || undefined}
              className={cn(
                thumbClassName,
                'transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive ? 'ring-2 ring-foreground ring-offset-1 ring-offset-[var(--module-workspace-bg,var(--background))]' : 'opacity-60 hover:opacity-100',
              )}
            >
              <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
              {savedUrls.has(url) && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" role="img" aria-label="已收藏" />}
            </button>
          );
        })}
        {Array.from({ length: pendingCount }, (_, index) => (
          <div key={`pending-${index}`} className={cn(thumbClassName, 'animate-pulse bg-[#0b0b0b]/[0.08] dark:bg-white/[0.06]')} aria-label="正在生成" />
        ))}
        {Array.from({ length: failedCount }, (_, index) => (
          <div
            key={`failed-${index}`}
            className={cn(thumbClassName, 'flex items-center justify-center bg-[var(--surface-control)] text-muted-foreground')}
            role="img"
            aria-label="这张生成失败"
            title="这张生成失败"
          >
            <ErrorWarning size={16} />
          </div>
        ))}
      </div>
    </div>
  );
};
