import { type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { durations } from './tokens';

export interface BorderBeamProps {
  /** 为 false 时淡出并卸载。 */
  active?: boolean;
  /** aurora 仅用于 AI 正在工作的瞬时状态；neutral 用于聚焦等常规反馈。 */
  tone?: 'aurora' | 'neutral';
  /** 光束线宽（px）。 */
  size?: number;
  /** 绕行一周的时长（秒）。 */
  duration?: number;
  /** 是否带外发光。 */
  glow?: boolean;
  /** 宿主边框宽度（px），用于让光束压在边框上。 */
  offset?: number;
  className?: string;
}

/**
 * 沿宿主圆角边框绕行的光束。宿主需要 `position: relative` 且有圆角；
 * 需要外发光时宿主不能 `overflow: hidden`。
 */
export const BorderBeam = ({ active = true, tone = 'aurora', size = 1.5, duration = 3.2, glow = true, offset = 1, className }: BorderBeamProps) => (
  <AnimatePresence>
    {active && (
      <motion.span
        aria-hidden="true"
        data-tone={tone}
        data-glow={glow ? '' : undefined}
        className={cn('motion-beam', className)}
        style={{ '--beam-size': `${size}px`, '--beam-duration': `${duration}s`, '--beam-offset': `${offset}px` } as CSSProperties}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: durations.slow }}
      />
    )}
  </AnimatePresence>
);
