import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAnimationFrame, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface ThinkingOrbProps {
  /** 直径（px）。 */
  size?: number;
  /** 为 true 时旋转并呼吸；为 false 时保持静止。 */
  active?: boolean;
  className?: string;
}

type Point = { x: number; y: number; z: number; phase: number };

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const createSphere = (count: number): Point[] => Array.from({ length: count }, (_, index) => {
  const y = 1 - (index / (count - 1)) * 2;
  const radius = Math.sqrt(1 - y * y);
  const theta = GOLDEN_ANGLE * index;
  return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius, phase: (index % 12) / 12 };
});

/**
 * 由点阵构成的旋转球体，表示 AI 正在思考。颜色取自 `currentColor`，
 * 因此可以直接用文字色类名控制。
 */
export const ThinkingOrb = ({ size = 28, active = true, className }: ThinkingOrbProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef('');
  const frameRef = useRef(0);
  const reduceMotion = useReducedMotion();
  const points = useMemo(() => createSphere(size >= 48 ? 220 : size >= 28 ? 130 : 80), [size]);

  const draw = useCallback((time: number, animated: boolean) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixels = Math.round(size * ratio);
    if (canvas.width !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    if (!colorRef.current || frameRef.current % 45 === 0) colorRef.current = getComputedStyle(canvas).color;
    frameRef.current += 1;

    const spin = time * 0.0009;
    const tilt = 0.42;
    const cosSpin = Math.cos(spin);
    const sinSpin = Math.sin(spin);
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);
    const center = pixels / 2;
    const radius = pixels * 0.4;
    const dot = Math.max(0.55, pixels / 62);

    context.clearRect(0, 0, pixels, pixels);
    context.fillStyle = colorRef.current;
    for (const point of points) {
      const breathe = animated ? 1 + 0.07 * Math.sin(time * 0.003 + point.phase * Math.PI * 2) : 1;
      const x = point.x * cosSpin + point.z * sinSpin;
      const depth = -point.x * sinSpin + point.z * cosSpin;
      const y = point.y * cosTilt - depth * sinTilt;
      const z = point.y * sinTilt + depth * cosTilt;
      const near = (z + 1) / 2;
      context.globalAlpha = 0.16 + near * 0.84;
      context.beginPath();
      context.arc(center + x * radius * breathe, center + y * radius * breathe, dot * (0.5 + near * 0.75), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }, [points, size]);

  const animated = active && !reduceMotion;

  useAnimationFrame((time) => {
    if (animated) draw(time, true);
  });

  useEffect(() => {
    if (!animated) draw(0, false);
  }, [animated, draw]);

  return <canvas ref={canvasRef} aria-hidden="true" className={cn('shrink-0', className)} style={{ width: size, height: size }} />;
};
