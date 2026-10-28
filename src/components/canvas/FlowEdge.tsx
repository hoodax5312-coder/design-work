import { memo, useRef, useState } from 'react';
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { Unlink } from '@/lib/remixIconShim';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { Tooltip } from '../ui';

/**
 * 画布连线：细贝塞尔曲线。悬停或选中时加深并在中点给出断开按钮；
 * 下游节点生成中时沿线流动，表示数据正在传递。
 */
export const FlowEdge = memo(({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, markerEnd }: EdgeProps) => {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.32 });
  const removeEdges = useCanvasStore((state) => state.removeEdges);
  const highlight = useCanvasStore((state) => state.selectedNodes.includes(source) || state.selectedNodes.includes(target));
  const running = useCanvasStore((state) => Boolean(state.nodes.find((node) => node.id === target)?.data?.isGenerating));
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<number | undefined>(undefined);

  const enter = () => {
    window.clearTimeout(leaveTimer.current);
    setHovered(true);
  };
  const leave = () => {
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(() => setHovered(false), 140);
  };

  return (
    <>
      <path
        d={path}
        fill="none"
        className="canvas-edge-path react-flow__edge-path"
        data-highlight={highlight || hovered || undefined}
        data-running={running || undefined}
        markerEnd={markerEnd}
      />
      <path d={path} fill="none" stroke="transparent" strokeWidth={18} className="react-flow__edge-interaction" onMouseEnter={enter} onMouseLeave={leave} />
      {(hovered || selected) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onMouseEnter={enter}
            onMouseLeave={leave}
          >
            <Tooltip content="断开连线">
              <button
                type="button"
                aria-label="断开连线"
                onClick={() => removeEdges([id])}
                className="motion-pop-in grid h-6 w-6 place-items-center rounded-full border border-border bg-popover text-muted-foreground shadow-sm transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <Unlink size={12} />
              </button>
            </Tooltip>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

FlowEdge.displayName = 'FlowEdge';
