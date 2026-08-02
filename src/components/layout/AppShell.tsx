import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Clapperboard,
  Command,
  Image,
  Infinity as InfinityIcon,
  Presentation,
  Search,
} from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { CreationModeSwitch } from './CreationModeSwitch';
import { ProjectSidebar } from './ProjectSidebar';
import { Button, Input } from '../ui';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const {
    activeModule,
    workspaceMode,
    setWorkspaceMode,
    setActiveModule,
  } = useUIStore();
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  const commands = useMemo(
    () => [
      { label: '首页', hint: '⌘1', icon: Boxes, run: () => setActiveModule('assets') },
      { label: '创作', hint: '⌘2', icon: Image, run: () => setActiveModule('image-gen') },
      {
        label: '视频生成',
        hint: '⌘3',
        icon: Clapperboard,
        run: () => setActiveModule('video-gen'),
      },
      { label: 'PPT 生成', hint: '⌘4', icon: Presentation, run: () => setActiveModule('ppt-gen') },
      { label: '无限画板', hint: '⌘5', icon: InfinityIcon, run: () => setActiveModule('magic-canvas') },
      { label: 'AI 应用', hint: '⌘6', icon: Command, run: () => setActiveModule('tools') },
    ],
    [setActiveModule],
  );
  const filteredCommands = commands.filter((command) =>
    command.label.toLowerCase().includes(commandQuery.toLowerCase()),
  );
  const showsCreationModeSwitch = activeModule === 'image-gen' || activeModule === 'magic-canvas';

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        if (event.key === 'Escape') setCommandOpen(false);
        return;
      }
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setWorkspaceMode(workspaceMode === 'editor' ? 'manager' : 'editor');
        return;
      }
      const modules = [
        'assets',
        'image-gen',
        'video-gen',
        'ppt-gen',
        'magic-canvas',
        'tools',
      ] as const;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < modules.length) {
        event.preventDefault();
        setWorkspaceMode('editor');
        setActiveModule(modules[index]);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [setActiveModule, setWorkspaceMode, workspaceMode]);

  const runCommand = (run: () => void) => {
    setWorkspaceMode('editor');
    run();
    setCommandOpen(false);
    setCommandQuery('');
  };

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-background font-sans text-foreground">
      <ProjectSidebar />

      <div className="app-workspace relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <main className="relative min-w-0 flex-1 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              {children}
            </div>
            {showsCreationModeSwitch && <CreationModeSwitch />}
          </main>
        </div>

        <footer className="flex h-7 shrink-0 items-center justify-between border-0 bg-background px-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> 本地工作区
            </span>
            <span>自动保存已开启</span>
          </div>
          <div className="flex items-center gap-3">
            <span>导出队列 空闲</span>
            <span>缓存 按需</span>
            <span>UTF-8</span>
          </div>
        </footer>
      </div>

      {commandOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-[2px]"
          onMouseDown={(event) => event.target === event.currentTarget && setCommandOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="命令面板"
            className="w-full max-w-lg overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
          >
            <label className="flex h-14 items-center gap-3 border-b px-4">
              <Search size={17} className="text-muted-foreground" />
              <Input
                autoFocus
                aria-label="搜索命令"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="前往工具或执行操作…"
                variant="ghost" className="h-12 min-w-0 flex-1 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <kbd className="rounded-md border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                ESC
              </kbd>
            </label>
            <div className="max-h-[390px] overflow-y-auto p-2">
              <div className="px-2 pb-2 pt-1 text-xs font-medium text-muted-foreground">
                快速打开
              </div>
              {filteredCommands.map((command) => {
                const Icon = command.icon;
                return (
                  <Button
                    type="button"
                    variant="ghost"
                    key={command.label}
                    onClick={() => runCommand(command.run)}
                    className="h-11 w-full justify-start gap-3 px-3 text-left text-sm"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-muted-foreground">
                      <Icon size={14} />
                    </span>
                    <span className="flex-1">{command.label}</span>
                    {command.hint && (
                      <kbd className="text-xs text-muted-foreground">{command.hint}</kbd>
                    )}
                  </Button>
                );
              })}
              {!filteredCommands.length && (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">没有匹配的命令</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
