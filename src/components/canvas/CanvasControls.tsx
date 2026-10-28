import { MiniMap, type Node } from '@xyflow/react';
import { useCanvasStore } from '../../stores/useCanvasStore';

const FIT_OPTIONS = { padding: 0.24, maxZoom: 1, duration: 260 };

const minimapNodeColor = (node: Node) => {
  if (node.data?.isGenerating) return 'var(--motion-aurora-3)';
  // 便签用自身颜色，分组只是一层很淡的底，不抢普通节点。
  if (node.type === 'note') return `var(--canvas-note-${String(node.data?.tint || 'amber')}-fill, var(--canvas-note-amber-fill))`;
  if (node.type === 'group') return 'color-mix(in srgb, transparent, var(--foreground) 6%)';
  if (node.type === 'imageGen') return 'color-mix(in srgb, transparent, var(--foreground) 34%)';
  if (node.type === 'video') return 'color-mix(in srgb, transparent, var(--foreground) 28%)';
  return 'color-mix(in srgb, transparent, var(--foreground) 18%)';
};

/** 小地图位于左下角视图控件上方，保留与 Agent 面板互斥的行为。 */
export const CanvasControls = () => {
  const showMinimap = useCanvasStore((state) => state.showMinimap);

  return showMinimap ? (
    <MiniMap
      position="bottom-left"
      pannable
      zoomable
      ariaLabel="小地图"
      className="motion-pop-in"
      nodeColor={minimapNodeColor}
      nodeStrokeWidth={0}
      nodeBorderRadius={6}
      bgColor="transparent"
      maskColor="color-mix(in srgb, transparent, var(--background) 55%)"
      maskStrokeColor="var(--border)"
      maskStrokeWidth={1}
      style={{ width: 200, height: 124, transformOrigin: 'bottom left' }}
    />
  ) : null;
};

export { FIT_OPTIONS };
