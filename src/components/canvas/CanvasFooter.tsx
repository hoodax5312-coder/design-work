import { Search, Grid, Map, ChevronDown } from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { cn } from '../../lib/utils';
import { Button, Card, Separator } from '../ui';

export const CanvasFooter = () => {
  const { snapNodesToGrid, toggleMinimap, showMinimap } = useCanvasStore();

  return (
    <div className="absolute bottom-4 right-4 flex flex-col items-end gap-4 z-50 pointer-events-none">
      {/* Zoom Controls */}
      <Card padding="sm" className="pointer-events-auto flex items-center gap-1 p-1">
        <Button variant="ghost" size="sm" className="min-w-[70px] justify-between text-xs">
          <span>100%</span>
          <ChevronDown size={12} />
        </Button>

        <Separator orientation="vertical" className="h-4" />

        <Button variant="ghost" size="iconSm" aria-label="搜索画布">
          <Search size={16} />
        </Button>

        <Separator orientation="vertical" className="h-4" />

        <Button variant="ghost" size="iconSm"
          onClick={snapNodesToGrid}
          title="对齐到网格"
        >
          <Grid size={16} />
        </Button>
        <Button variant={showMinimap ? 'secondary' : 'ghost'} size="iconSm"
          onClick={toggleMinimap}
          className={cn(showMinimap && 'text-foreground')}
          title="显示/隐藏小地图"
        >
          <Map size={16} />
        </Button>
      </Card>
    </div>
  );
};
