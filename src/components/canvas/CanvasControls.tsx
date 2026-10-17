import { MiniMap, Panel, useReactFlow, useViewport, type Node } from '@xyflow/react';
import { Check, ChevronDown, Focus, Map, ZoomIn, ZoomOut } from '@/lib/remixIconShim';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '../ui';

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

/** 顶部居中：缩放条；小地图在左下角。百分比菜单里放常用缩放档位和吸附网格。 */
export const CanvasControls = ({ snapToGrid, onSnapToGridChange }: { snapToGrid: boolean; onSnapToGridChange: (value: boolean) => void }) => {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const showMinimap = useCanvasStore((state) => state.showMinimap);
  const toggleMinimap = useCanvasStore((state) => state.toggleMinimap);

  return (
    <>
      {showMinimap && (
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
          style={{ width: 200, height: 124, left: 12, bottom: 12, transformOrigin: 'bottom left' }}
        />
      )}

      <Panel position="top-center" className="!m-3">
        <div className="canvas-chrome flex h-11 items-center gap-0.5 rounded-xl px-1.5">
          <Tooltip content={showMinimap ? '隐藏小地图' : '显示小地图'} side="bottom">
            <button type="button" className="canvas-icon-button" aria-label="小地图" aria-pressed={showMinimap} data-active={showMinimap || undefined} onClick={toggleMinimap}><Map size={16} /></button>
          </Tooltip>
          <Tooltip content="适应画布" shortcut="⇧1" side="bottom">
            <button type="button" className="canvas-icon-button" aria-label="适应画布" onClick={() => void fitView(FIT_OPTIONS)}><Focus size={16} /></button>
          </Tooltip>
          <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
          <Tooltip content="缩小" shortcut="⌘−" side="bottom">
            <button type="button" className="canvas-icon-button" aria-label="缩小" onClick={() => void zoomOut({ duration: 160 })}><ZoomOut size={16} /></button>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="缩放比例" className="flex h-8 min-w-[58px] items-center justify-center gap-0.5 rounded-md px-1.5 text-xs font-medium tabular-nums text-foreground transition-colors hover:bg-accent data-[state=open]:bg-accent">
                {Math.round(zoom * 100)}%
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="center" className="w-[188px]">
              <DropdownMenuItem shortcut="⇧1" onSelect={() => void fitView(FIT_OPTIONS)}>适应画布</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void zoomTo(0.5, { duration: 200 })}>50%</DropdownMenuItem>
              <DropdownMenuItem shortcut="⇧0" onSelect={() => void zoomTo(1, { duration: 200 })}>100%</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void zoomTo(2, { duration: 200 })}>200%</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={snapToGrid ? Check : undefined} className={snapToGrid ? undefined : 'pl-[30px]'} onSelect={() => onSnapToGridChange(!snapToGrid)}>吸附网格</DropdownMenuItem>
              <DropdownMenuItem icon={showMinimap ? Check : undefined} className={showMinimap ? undefined : 'pl-[30px]'} onSelect={toggleMinimap}>小地图</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip content="放大" shortcut="⌘=" side="bottom">
            <button type="button" className="canvas-icon-button" aria-label="放大" onClick={() => void zoomIn({ duration: 160 })}><ZoomIn size={16} /></button>
          </Tooltip>
        </div>
      </Panel>
    </>
  );
};

export { FIT_OPTIONS };
