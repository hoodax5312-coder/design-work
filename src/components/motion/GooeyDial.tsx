import { useEffect, useId, useRef, type ElementType, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { springs } from './tokens';

export interface GooeyDialItem {
  id: string;
  label: string;
  icon: ElementType;
  /** 显示在标签旁的快捷键提示。 */
  shortcut?: string;
  onSelect: () => void;
}

export interface GooeyDialProps {
  items: GooeyDialItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 触发按钮的无障碍名称。 */
  label: string;
  icon: ElementType;
  /** 触发按钮直径（px）。 */
  size?: number;
  /** 展开项直径（px）。 */
  itemSize?: number;
  /** 展开项间距（px），需大于模糊半径的两倍，静止时才会彼此分离。 */
  gap?: number;
  className?: string;
}

/**
 * 黏性展开的快捷拨盘：触发按钮向右“分裂”出一排圆形操作。
 * 黏连效果只作用在纯色底层，图标与文字渲染在其上方，不受滤镜影响。
 */
export const GooeyDial = ({ items, open, onOpenChange, label, icon: Icon, size = 40, itemSize = 36, gap = 12, className }: GooeyDialProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const filterId = `gooey-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const inset = (size - itemSize) / 2;
  const offsetFor = (index: number) => size + gap + index * (itemSize + gap) - inset;
  const extent = size + gap + items.length * (itemSize + gap);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    window.addEventListener('pointerdown', closeOnOutside, true);
    const focusTimer = window.setTimeout(() => itemRefs.current[0]?.focus({ preventScroll: true }), 60);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutside, true);
      window.clearTimeout(focusTimer);
    };
  }, [onOpenChange, open]);

  const close = (restoreFocus = true) => {
    onOpenChange(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const current = itemRefs.current.findIndex((element) => element === document.activeElement);
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = (current + step + items.length) % items.length;
    itemRefs.current[next]?.focus({ preventScroll: true });
  };

  return (
    <div ref={rootRef} className={cn('relative shrink-0', className)} style={{ width: size, height: size }} onKeyDown={handleKeyDown}>
      <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
        <defs>
          <filter id={filterId} x="-10%" y="-80%" width="120%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0" style={{ width: extent, height: size, filter: `url(#${filterId})` }}>
        <span className="absolute left-0 top-0 rounded-full bg-foreground" style={{ width: size, height: size }} />
        {items.map((item, index) => (
          <motion.span
            key={item.id}
            className="absolute rounded-full bg-foreground"
            style={{ width: itemSize, height: itemSize, left: inset, top: inset }}
            initial={false}
            animate={{ x: open ? offsetFor(index) : 0, scale: open ? 1 : 0.5 }}
            transition={{ ...springs.bouncy, delay: open ? index * 0.035 : (items.length - 1 - index) * 0.02 }}
          />
        ))}
      </div>

      <motion.button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        onClick={() => onOpenChange(!open)}
        whileTap={{ scale: 0.92 }}
        className="absolute inset-0 grid place-items-center rounded-full text-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <motion.span className="grid place-items-center" initial={false} animate={{ rotate: open ? 45 : 0 }} transition={springs.bouncy}>
          <Icon size={20} />
        </motion.span>
      </motion.button>

      <div role="menu" aria-label={label} aria-hidden={!open}>
        {items.map((item, index) => {
          const ItemIcon = item.icon;
          return (
            <motion.button
              key={item.id}
              ref={(element) => { itemRefs.current[index] = element; }}
              type="button"
              role="menuitem"
              tabIndex={open ? 0 : -1}
              aria-label={item.shortcut ? `${item.label}（${item.shortcut}）` : item.label}
              onClick={() => { item.onSelect(); close(false); }}
              className="group absolute grid place-items-center rounded-full text-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{ width: itemSize, height: itemSize, left: inset, top: inset, pointerEvents: open ? 'auto' : 'none' }}
              initial={false}
              animate={{ x: open ? offsetFor(index) : 0, opacity: open ? 1 : 0, scale: open ? 1 : 0.5 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              transition={{ ...springs.bouncy, delay: open ? index * 0.035 : (items.length - 1 - index) * 0.02 }}
            >
              <ItemIcon size={17} />
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-full mt-2 flex items-center gap-1 whitespace-nowrap rounded-full border border-border bg-popover px-2 py-0.5 text-[11px] font-medium leading-4 text-popover-foreground shadow-sm"
                initial={false}
                animate={{ opacity: open ? 1 : 0, x: '-50%', y: open ? 0 : -4 }}
                transition={{ ...springs.snappy, delay: open ? 0.12 + index * 0.03 : 0 }}
              >
                {item.label}
                {item.shortcut && <span className="text-muted-foreground">{item.shortcut}</span>}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
