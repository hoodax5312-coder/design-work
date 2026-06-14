import { useState } from 'react';
import { X, Settings, Key, Cpu, Database } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { cn } from '../../lib/utils';
import { GeneralSettings, ApiSettings, ModelsSettings, StorageSettings } from './settings';

type TabType = 'general' | 'storage' | 'api' | 'models';

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: '通用', icon: Settings },
  { id: 'storage', label: '数据存储', icon: Database },
  { id: 'api', label: 'API 配置', icon: Key },
  { id: 'models', label: '模型管理', icon: Cpu },
];

export const SettingsModal = () => {
  const { modalOpen, closeModal } = useUIStore();
  const [activeTab, setActiveTab] = useState<TabType>('general');

  if (modalOpen !== 'settings') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeModal}
      />

      {/* Modal */}
      <div className="relative w-[700px] max-h-[85vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex">
        {/* Sidebar */}
        <div className="w-48 bg-slate-50 dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 p-4 flex flex-col">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
            设置
          </h2>
          <nav className="space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === id
                    ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                )}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h3>
            <button
              onClick={closeModal}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && (
              <GeneralSettings />
            )}
            {activeTab === 'api' && (
              <ApiSettings />
            )}
            {activeTab === 'storage' && <StorageSettings />}
            {activeTab === 'models' && <ModelsSettings />}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-3">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              取消
            </button>
            <button onClick={closeModal} className="px-4 py-2 text-sm font-medium bg-slate-950 hover:bg-slate-800 text-white rounded-lg transition-colors">
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
