import { ReactNode } from 'react';
import { Moon, PanelLeft, Settings, Sun } from 'lucide-react';
import { ProjectSidebar } from './ProjectSidebar';
import { useUIStore } from '../../stores/useUIStore';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const { theme, toggleProjectSidebar, toggleTheme, openModal } = useUIStore();

  return (
    <div className="flex min-h-[100dvh] w-screen overflow-hidden bg-white dark:bg-zinc-950">
      <div className="flex flex-1 relative overflow-hidden">
        <ProjectSidebar />

        <div className="relative flex h-[100dvh] flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950">
          <header className="flex h-9 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
            <button
              onClick={toggleProjectSidebar}
              aria-label="收起或展开侧边栏"
              className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              title="收起/展开侧边栏"
            >
              <PanelLeft size={16} />
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                aria-label="切换暗黑模式"
                className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                title="切换暗黑模式"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                onClick={() => openModal('settings')}
                aria-label="打开设置"
                className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                title="设置"
              >
                <Settings size={16} />
              </button>
            </div>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-white dark:bg-black">
            <main className="absolute inset-0 z-0 overflow-hidden">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};
