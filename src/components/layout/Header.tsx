import { LayoutGrid, PanelLeft, Sun, Moon, Settings } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';

export const Header = () => {
  const { theme, toggleProjectSidebar, toggleTheme, openModal } = useUIStore();

  return (
    <div className="h-9 bg-white dark:bg-zinc-900 flex items-center justify-between px-4 z-[60] relative transition-colors">
      {/* Left: Logo & Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center text-white">
            <LayoutGrid size={12} />
          </div>
          <span className="font-bold text-sm text-slate-800 dark:text-white">Mboard</span>
        </div>
        
        <div className="w-px h-3 bg-slate-200 dark:bg-white/10" />
        
        <button 
          onClick={toggleProjectSidebar}
          className="p-1 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors"
        >
          <PanelLeft size={14} />
        </button>
      </div>

      {/* Right: Global Actions */}
      <div className="flex items-center gap-1">
        <button 
          onClick={toggleTheme}
          className="p-1 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <button 
          onClick={() => openModal('settings')}
          className="p-1 text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors"
        >
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
};
