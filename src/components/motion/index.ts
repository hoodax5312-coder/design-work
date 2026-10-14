/**
 * 统一动效库。
 * - 进出场、布局、手势：framer-motion + tokens.ts 中的弹簧与变体。
 * - 环境动效：BorderBeam / ThinkingOrb / ShimmerText / AuroraVeil / GooeyDial。
 * 业务组件只从这里取动效，不各自写时长与缓动。
 */
import './motion.css';

export { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from 'framer-motion';
export { dockVariants, durations, easings, popVariants, pressScale, springs, staggerItem, staggerParent } from './tokens';
export { BorderBeam, type BorderBeamProps } from './BorderBeam';
export { ThinkingOrb, type ThinkingOrbProps } from './ThinkingOrb';
export { GooeyDial, type GooeyDialItem, type GooeyDialProps } from './GooeyDial';
export { AuroraVeil, ShimmerText } from './effects';
