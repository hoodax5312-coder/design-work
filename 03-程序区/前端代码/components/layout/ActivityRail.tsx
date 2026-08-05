import {
  Boxes,
  Clapperboard,
  Command,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  Moon,
  Presentation,
  Settings,
  Sun,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { ModuleType, useUIStore } from '../../stores/useUIStore';
import { Button } from '../ui';

const editorTools: Array<{ icon: React.ElementType; label: string; module: ModuleType }> = [
  { icon: Boxes, label: '资产库', module: 'assets' },
  { icon: ImageIcon, label: '图片生成', module: 'image-gen' },
  { icon: Clapperboard, label: '视频生成', module: 'video-gen' },
  { icon: Presentation, label: 'PPT 生成', module: 'ppt-gen' },
  { icon: InfinityIcon, label: '无限画板', module: 'magic-canvas' },
  { icon: Command, label: 'AI 应用', module: 'tools' },
];

export const ActivityRail = () => {
  const { activeModule, workspaceMode, theme, setActiveModule, setWorkspaceMode, toggleTheme, openModal } = useUIStore();

  const openEditor = (module: ModuleType) => {
    setWorkspaceMode('editor');
    setActiveModule(module);
  };

  return (
    <nav className="flex h-full w-16 shrink-0 flex-col items-center border-r border-black/[0.08] bg-[#f8f8f7] py-2 dark:border-white/10 dark:bg-[#0d0d0d]">
      <Button type="button" variant="primary" size="iconSm"
        onClick={() => openEditor('assets')}
        aria-label="Mboard 资产库"
        className="relative mb-4 h-8 w-8 shadow-sm"
      >
        <Command size={16} strokeWidth={2.3} />
        <span className="absolute -bottom-0.5 h-[3px] w-4 rounded-full bg-[#c8ff00]" />
      </Button>

      <div className="flex flex-1 flex-col items-center gap-1">
        {editorTools.map((tool, index) => (
          <div key={tool.module} className="flex flex-col items-center gap-1">
            {index === 1 && <div className="my-1 h-px w-5 bg-black/10 dark:bg-white/10" />}
            <RailButton
              icon={tool.icon}
              label={tool.label}
              active={workspaceMode === 'editor' && activeModule === tool.module}
              onClick={() => openEditor(tool.module)}
            />
          </div>
        ))}
        <div className="mt-1 text-xs font-semibold text-slate-300 dark:text-zinc-700">⌘K</div>
      </div>

      <div className="flex w-full flex-col items-center gap-1 pb-1">
        <RailButton icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? '切换为明亮模式' : '切换为暗黑模式'} active={false} onClick={toggleTheme} utility />
        <RailButton icon={Settings} label="设置" active={false} onClick={() => openModal('settings')} utility />
      </div>
    </nav>
  );
};

const RailButton = ({
  icon: Icon,
  label,
  active,
  onClick,
  utility = false,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  utility?: boolean;
}) => (
  <Button type="button" variant="ghost" size="iconSm"
    onClick={onClick}
    aria-label={label}
    title={label}
    className={cn(
      'group relative',
      utility ? 'h-10 w-10' : 'h-9 w-9',
      active
        ? 'bg-black/[0.08] text-black dark:bg-white/10 dark:text-white'
        : 'text-slate-400 hover:bg-black/[0.045] hover:text-slate-800 dark:text-zinc-600 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200',
    )}
  >
    <Icon size={utility ? 20 : 18} strokeWidth={active ? 2.2 : 1.8} />
  </Button>
);
