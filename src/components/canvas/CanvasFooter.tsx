import { Search, Grid, Map, ChevronDown } from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { cn } from '../../lib/utils';

export const CanvasFooter = () => {
  const { snapNodesToGrid, toggleMinimap, showMinimap } = useCanvasStore();

  return (
    <div className="absolute bottom-4 right-4 flex flex-col items-end gap-4 z-50 pointer-events-none">
      {/* Zoom Controls */}
      <div className="pointer-events-auto flex items-center gap-2 bg-white dark:bg-zinc-800 p-1 rounded-xl shadow-lg border border-white/50 dark:border-white/10 backdrop-blur-sm transition-colors">
        <button className="flex items-center gap-1 px-2 py-1.5 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-md transition-colors text-xs font-medium min-w-[70px] justify-between">
          <span>100%</span>
          <ChevronDown size={12} />
        </button>

        <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700" />

        <button className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-md transition-colors">
          <Search size={16} />
        </button>

        <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700" />

        <button
          onClick={snapNodesToGrid}
          className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-md transition-colors"
          title="对齐到网格"
        >
          <Grid size={16} />
        </button>
        <button
          onClick={toggleMinimap}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            showMinimap
              ? 'text-slate-800 dark:text-zinc-100 bg-slate-100 dark:bg-zinc-700'
              : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700'
          )}
          title="显示/隐藏小地图"
        >
          <Map size={16} />
        </button>
      </div>
    </div>
  );
};
