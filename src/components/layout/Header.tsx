import { LayoutGrid, PanelLeft, Sun, Moon, Settings } from '@/lib/remixIconShim';
import { useUIStore } from '../../stores/useUIStore';
import { Button, Separator } from '../ui';

export const Header = () => {
  const { theme, toggleProjectSidebar, toggleTheme, setActiveModule } = useUIStore();

  return (
    <div className="relative z-[60] flex h-9 items-center justify-between border-b border-border bg-background px-4">
      {/* Left: Logo & Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground">
            <LayoutGrid size={12} />
          </div>
          <span className="text-sm font-bold text-foreground">栗作 LIZUO</span>
        </div>
        
        <Separator orientation="vertical" className="h-3" />
        
        <Button variant="ghost" size="iconSm"
          onClick={toggleProjectSidebar}
          aria-label="切换项目侧栏" className="h-7 w-7"
        >
          <PanelLeft size={14} />
        </Button>
      </div>

      {/* Right: Global Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="iconSm"
          onClick={toggleTheme}
          aria-label="切换主题" className="h-7 w-7"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </Button>
        <Button variant="ghost" size="iconSm"
          onClick={() => setActiveModule('settings')}
          aria-label="打开设置" className="h-7 w-7"
        >
          <Settings size={14} />
        </Button>
      </div>
    </div>
  );
};
