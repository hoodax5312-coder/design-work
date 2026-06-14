import { Monitor } from 'lucide-react';
import { useUIStore } from '../../../stores/useUIStore';
import { cn } from '../../../lib/utils';

export function GeneralSettings() {
  const { theme, toggleTheme } = useUIStore();

  return (
    <div className="space-y-6">
      {/* Interface Preferences */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <Monitor size={16} /> 界面偏好
        </h4>
        <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-slate-200 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                外观主题
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                切换系统的明亮/暗黑模式
              </div>
            </div>
            <div className="flex bg-slate-200 dark:bg-zinc-900 p-1 rounded-lg">
              <button
                onClick={() => theme === 'dark' && toggleTheme()}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  theme === 'light'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                明亮
              </button>
              <button
                onClick={() => theme === 'light' && toggleTheme()}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  theme === 'dark'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                暗黑
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
