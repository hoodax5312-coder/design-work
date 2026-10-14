import type { Transition, Variants } from 'framer-motion';

/**
 * 统一动效令牌。所有进出场、布局与手势过渡都从这里取值，
 * 循环类环境动效（光束、流光）的时长写在 motion.css 的同名 CSS 变量里。
 */
export const springs = {
  /** 菜单、气泡、按钮等小体量元素。 */
  snappy: { type: 'spring', stiffness: 560, damping: 38, mass: 0.7 },
  /** 侧栏、面板等大体量元素。 */
  smooth: { type: 'spring', stiffness: 340, damping: 34, mass: 0.9 },
  /** 节点入场、新增反馈，带一次轻微回弹。 */
  bouncy: { type: 'spring', stiffness: 440, damping: 26, mass: 0.8 },
} satisfies Record<string, Transition>;

export const durations = { fast: 0.12, base: 0.18, slow: 0.28 } as const;

export const easings = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

const exitTransition: Transition = { duration: durations.fast, ease: easings.out };

/** 浮层（菜单、气泡、提示条）的缩放淡入。 */
export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springs.snappy },
  exit: { opacity: 0, scale: 0.98, y: 2, transition: exitTransition },
};

/** 贴边浮动控件的入场，按所在边给一个很短的位移。 */
export const dockVariants = (side: 'left' | 'right' | 'top' | 'bottom', distance = 12): Variants => {
  const offset = side === 'left' || side === 'top' ? -distance : distance;
  const at = (value: number) => (side === 'left' || side === 'right' ? { x: value } : { y: value });
  return {
    hidden: { opacity: 0, ...at(offset) },
    visible: { opacity: 1, ...at(0), transition: springs.smooth },
    exit: { opacity: 0, ...at(offset), transition: exitTransition },
  };
};

/** 列表逐项入场：父级用 staggerParent，子级用 staggerItem。 */
export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: springs.snappy },
};

/** 按下反馈，供 whileTap 使用。 */
export const pressScale = { scale: 0.96 } as const;
