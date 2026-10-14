import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** 文字流光，用于“生成中 / 思考中”等进行态文案。颜色取自当前文字色。 */
export const ShimmerText = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('motion-shimmer', className)} {...props} />
);

/** 生成中的光幕占位。放在 `position: relative` 且有圆角的容器内。 */
export const AuroraVeil = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span aria-hidden="true" className={cn('motion-aurora-veil', className)} {...props} />
);
