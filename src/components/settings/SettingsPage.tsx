import { useState } from 'react';
import { Database, Key, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { ApiSettings, GeneralSettings, StorageSettings } from '../modals/settings';

type SettingsTab = 'general' | 'storage' | 'api';

const SETTINGS_TABS: Array<{
  id: SettingsTab;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { id: 'general', label: '通用', description: '外观与工作台偏好', icon: Settings },
  { id: 'storage', label: '数据存储', description: '本地目录与缓存策略', icon: Database },
  { id: 'api', label: 'API 与模型', description: '服务商、密钥和模型能力', icon: Key },
];

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const activeSettings = SETTINGS_TABS.find((tab) => tab.id === activeTab) || SETTINGS_TABS[0];

  return (
    <main className="module-workspace flex h-full min-h-0 overflow-hidden text-foreground" aria-label="工作台设置">
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--surface-border)] bg-[var(--surface-control)]/45 p-4">
        <div className="mb-6 px-2">
          <h1 className="text-xl font-semibold tracking-tight">设置</h1>
        </div>

        <nav aria-label="设置分类" className="space-y-1">
          {SETTINGS_TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <Button
                key={id}
                type="button"
                variant="ghost"
                onClick={() => setActiveTab(id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'h-auto w-full justify-start gap-3 px-3 py-3 text-left',
                  active
                    ? 'bg-foreground text-background hover:bg-foreground hover:text-background'
                    : 'text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground',
                )}
              >
                <Icon size={17} className="shrink-0" />
                <span className="min-w-0 truncate text-sm font-medium">{label}</span>
              </Button>
            );
          })}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="flex min-h-20 shrink-0 items-center px-8">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{activeSettings.label}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{activeSettings.description}，修改后自动保存在本机工作区。</p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
          <div className="max-w-5xl">
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'storage' && <StorageSettings />}
            {activeTab === 'api' && <ApiSettings />}
          </div>
        </div>
      </section>
    </main>
  );
};
