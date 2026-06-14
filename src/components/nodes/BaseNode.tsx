import { type ReactNode, type ElementType } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '../../lib/utils';
import { Copy, Trash2 } from 'lucide-react';

export type NodeTheme = 'indigo' | 'purple' | 'pink' | 'blue' | 'green' | 'orange';

interface NodeThemeConfig {
  icon: string;
  iconBg: string;
  handle: string;
  selectedBorder: string;
  selectedShadow: string;
  hoverBorder: string;
}

const themeConfigs: Record<NodeTheme, NodeThemeConfig> = {
  indigo: {
    icon: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-50 dark:bg-indigo-500/20',
    handle: '!bg-indigo-500',
    selectedBorder: 'border-indigo-500',
    selectedShadow: 'shadow-[0_0_0_2px_rgba(99,102,241,0.2)]',
    hoverBorder: 'hover:border-indigo-300 dark:hover:border-indigo-700',
  },
  purple: {
    icon: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-50 dark:bg-purple-500/20',
    handle: '!bg-purple-500',
    selectedBorder: 'border-purple-500',
    selectedShadow: 'shadow-[0_0_0_2px_rgba(168,85,247,0.2)]',
    hoverBorder: 'hover:border-purple-300 dark:hover:border-purple-700',
  },
  pink: {
    icon: 'text-pink-600 dark:text-pink-400',
    iconBg: 'bg-pink-50 dark:bg-pink-500/20',
    handle: '!bg-pink-500',
    selectedBorder: 'border-pink-500',
    selectedShadow: 'shadow-[0_0_0_2px_rgba(236,72,153,0.2)]',
    hoverBorder: 'hover:border-pink-300 dark:hover:border-pink-700',
  },
  blue: {
    icon: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-500/20',
    handle: '!bg-blue-500',
    selectedBorder: 'border-blue-500',
    selectedShadow: 'shadow-[0_0_0_2px_rgba(59,130,246,0.2)]',
    hoverBorder: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  green: {
    icon: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-50 dark:bg-green-500/20',
    handle: '!bg-green-500',
    selectedBorder: 'border-green-500',
    selectedShadow: 'shadow-[0_0_0_2px_rgba(34,197,94,0.2)]',
    hoverBorder: 'hover:border-green-300 dark:hover:border-green-700',
  },
  orange: {
    icon: 'text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-50 dark:bg-orange-500/20',
    handle: '!bg-orange-500',
    selectedBorder: 'border-orange-500',
    selectedShadow: 'shadow-[0_0_0_2px_rgba(249,115,22,0.2)]',
    hoverBorder: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
};

export interface BaseNodeProps {
  children: ReactNode;
  selected?: boolean;
  theme?: NodeTheme;
  icon: ElementType;
  title: string;
  width?: number;
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;
  onCopy?: () => void;
  onDelete?: () => void;
  className?: string;
  headerExtra?: ReactNode;
}

export function BaseNode({
  children,
  selected = false,
  theme = 'indigo',
  icon: Icon,
  title,
  width = 280,
  showSourceHandle = true,
  showTargetHandle = false,
  onCopy,
  onDelete,
  className,
  headerExtra,
}: BaseNodeProps) {
  const config = themeConfigs[theme];

  return (
    <div className="relative group">
      {/* Target Handle */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className={cn(
            '!w-3 !h-3 !border-2 !border-white dark:!border-zinc-900 transition-transform duration-200',
            config.handle,
            selected ? 'scale-125' : 'scale-100'
          )}
        />
      )}

      {/* Main Card */}
      <div
        style={{ width }}
        className={cn(
          'bg-white dark:bg-zinc-900 rounded-xl border transition-all duration-200 overflow-hidden shadow-sm',
          selected
            ? cn(config.selectedBorder, config.selectedShadow)
            : cn('border-slate-200 dark:border-zinc-800', config.hoverBorder),
          className
        )}
      >
        {/* Header */}
        <div className="h-10 px-4 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className={cn('p-1 rounded', config.iconBg)}>
              <Icon className={cn('w-4 h-4', config.icon)} />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {headerExtra}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onCopy && (
                <button
                  onClick={onCopy}
                  className={cn(
                    'p-1 text-slate-400 rounded transition-colors',
                    `hover:${config.icon} hover:${config.iconBg}`
                  )}
                >
                  <Copy size={14} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-zinc-900">{children}</div>
      </div>

      {/* Source Handle */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className={cn(
            '!w-3 !h-3 !border-2 !border-white dark:!border-zinc-900 transition-transform duration-200',
            config.handle,
            selected ? 'scale-125' : 'scale-100'
          )}
        />
      )}
    </div>
  );
}

// Re-export theme configs for external use
export { themeConfigs };
