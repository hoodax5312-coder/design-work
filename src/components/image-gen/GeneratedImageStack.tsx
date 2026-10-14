import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { cn } from '../../lib/utils';
import { easings, motion, useReducedMotion } from '../motion';

interface StackImageInteractions {
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
}

interface StackCard {
  key: string;
  url?: string;
}

const DEFAULT_RATIO = 4 / 3;
const MIN_HEIGHT = 240;
const MAX_HEIGHT = 680;
const GAP = 8;
/** Each card behind the front one peeks out this far to the right. */
const PEEK_OFFSET = 10;
const MAX_PEEK = 2;
const BACK_SCALE = 0.96;
/** Per-layer tilt, capped so a card's corners rise at most PEEK_LIFT px above its edge. */
const MAX_ANGLE = 3;
const PEEK_LIFT = 8;
/** Room kept to the right of the front card for the peeking cards and their rotation. */
const STACK_ROOM = 40;

const savedBadgeClassName = 'pointer-events-none absolute left-2 top-2 z-20 inline-flex h-5 items-center rounded bg-black/55 px-1.5 text-[11px] font-medium leading-none text-white backdrop-blur-sm';

/**
 * Multiple outputs of one generation sit as a stack: the front card keeps the single-image height,
 * up to two cards peek out behind it, and expanding slides them into a scrollable row of the same height.
 */
export const GeneratedImageStack = ({
  images,
  alt,
  pendingCount = 0,
  failedCount = 0,
  progress,
  expanded,
  onToggle,
  selectedUrl,
  savedUrls,
  ratios,
  onRatioChange,
  interactions,
}: {
  images: string[];
  alt: string;
  pendingCount?: number;
  failedCount?: number;
  progress?: { done: number; total: number };
  expanded: boolean;
  onToggle?: () => void;
  selectedUrl?: string;
  savedUrls: Set<string>;
  ratios: Record<string, number>;
  onRatioChange: (url: string, ratio: number) => void;
  interactions: (url: string) => StackImageInteractions;
}) => {
  const reduceMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const cards: StackCard[] = [
    ...images.map((url) => ({ key: url, url })),
    ...Array.from({ length: pendingCount }, (_, index) => ({ key: `pending-${index}` })),
  ];
  const fallbackRatio = (images[0] && ratios[images[0]]) || DEFAULT_RATIO;
  const ratioOf = (card: StackCard) => (card.url && ratios[card.url]) || fallbackRatio;
  const frontRatio = cards[0] ? ratioOf(cards[0]) : DEFAULT_RATIO;
  const height = viewportWidth
    ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, (viewportWidth - STACK_ROOM) / frontRatio))
    : MIN_HEIGHT;
  const widths = cards.map((card) => height * ratioOf(card));
  const lefts = widths.map((_, index) => widths.slice(0, index).reduce((sum, width) => sum + width + GAP, 0));

  const transition = { duration: reduceMotion ? 0 : 0.2, ease: [...easings.out] };
  const collapsedPose = (index: number) => {
    const depth = Math.min(index, MAX_PEEK);
    const scale = index ? BACK_SCALE : 1;
    // Wide cards get a smaller angle so their corners never lift more than PEEK_LIFT per layer.
    const angle = Math.min(MAX_ANGLE, (Math.atan(PEEK_LIFT / (widths[index] / 2)) * 180) / Math.PI);
    return {
      // Right edges line up with the front card (undoing the centred scale), then shift by the peek offset.
      x: -lefts[index] + (widths[0] - widths[index]) + (widths[index] * (1 - scale)) / 2 + depth * PEEK_OFFSET,
      rotate: depth * angle,
      scale,
      opacity: index > MAX_PEEK ? 0 : 1,
      filter: index ? 'brightness(0.78)' : 'brightness(1)',
    };
  };
  const flatPose = { x: 0, rotate: 0, scale: 1, opacity: 1, filter: 'brightness(1)' };

  const canToggle = Boolean(onToggle) && cards.length > 1;
  const hiddenSaved = !expanded && images.slice(1).some((url) => savedUrls.has(url));
  const showCapsule = canToggle || Boolean(progress) || failedCount > 0;

  return (
    <div className="mx-2 flex items-center gap-2">
      <div
        ref={viewportRef}
        className={cn('min-w-0 flex-1', expanded ? 'overflow-x-auto overflow-y-hidden' : 'overflow-x-clip overflow-y-visible')}
      >
        <div className="relative flex py-3" style={{ gap: GAP, width: expanded ? 'max-content' : undefined }}>
          {cards.map((card, index) => {
            const hidden = !expanded && index > 0;
            // Collapsed, the front card stands in for whichever image of the group is selected.
            const selected = Boolean(card.url) && (expanded ? selectedUrl === card.url : index === 0 && Boolean(selectedUrl) && images.includes(selectedUrl as string));
            return (
              <motion.div
                key={card.key}
                initial={false}
                animate={expanded ? flatPose : collapsedPose(index)}
                transition={transition}
                {...(card.url && !hidden ? interactions(card.url) : {})}
                aria-hidden={hidden || undefined}
                className={cn(
                  'group relative flex shrink-0 cursor-default items-center justify-center overflow-hidden rounded-lg bg-[#0b0b0b] dark:border dark:border-white/10',
                  index > 0 && 'shadow-[0_6px_18px_rgba(0,0,0,0.16)] dark:shadow-none',
                  hidden && 'pointer-events-none',
                  selected && 'ring-2 ring-inset ring-foreground',
                )}
                style={{ width: widths[index], height, zIndex: expanded ? undefined : cards.length - index }}
              >
                {card.url ? (
                  <button
                    type="button"
                    tabIndex={hidden ? -1 : undefined}
                    aria-label={`选择第 ${index + 1} 张生成图片（双击全屏，右键更多操作）`}
                    aria-pressed={selected}
                    className="flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <img
                      src={card.url}
                      alt={`${alt}，第 ${index + 1} 张`}
                      draggable={false}
                      onLoad={(event) => onRatioChange(card.url as string, Math.max(DEFAULT_RATIO, event.currentTarget.naturalWidth / event.currentTarget.naturalHeight))}
                      className="max-h-full max-w-full object-contain"
                    />
                  </button>
                ) : (
                  <div className="h-full w-full animate-pulse bg-white/[0.06]" aria-label="正在生成" />
                )}
                {card.url && !hidden && savedUrls.has(card.url) && <span className={savedBadgeClassName}>已收藏</span>}
              </motion.div>
            );
          })}
        </div>
      </div>

      {showCapsule && (
        <button
          type="button"
          onClick={canToggle ? onToggle : undefined}
          disabled={!canToggle}
          aria-expanded={canToggle ? expanded : undefined}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[var(--surface-control)] px-3 text-xs transition-colors enabled:hover:bg-[var(--surface-border-strong)] disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {progress ? (
            <span className="font-medium tabular-nums text-foreground">{progress.done}/{progress.total}</span>
          ) : canToggle && (expanded ? (
            <span className="text-foreground">收起</span>
          ) : (
            <>
              <span className="text-muted-foreground">展开</span>
              <span className="font-medium tabular-nums text-foreground">{cards.length}</span>
            </>
          ))}
          {failedCount > 0 && <span className="text-destructive">{progress || canToggle ? '· ' : ''}{failedCount} 张失败</span>}
          {hiddenSaved && <span className="ml-0.5 size-1.5 rounded-full bg-foreground" role="img" aria-label="后面有已收藏的图片" title="后面有已收藏的图片" />}
        </button>
      )}
    </div>
  );
};
