import { useState } from 'react';
import { Database, Key, RotateCcw, Settings } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { ApiSettings, GeneralSettings, StorageSettings } from '../modals/settings';
import { useUIStore } from '../../stores/useUIStore';

type SettingsTab = 'general' | 'storage' | 'api';

const SETTINGS_TABS: Array<{
  id: SettingsTab;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { id: 'general', label: '个性化设置', description: '外观与工作台偏好', icon: Settings },
  { id: 'storage', label: '数据存储', description: '本地目录与缓存策略', icon: Database },
  { id: 'api', label: 'API 与模型', description: '服务商、密钥和模型能力', icon: Key },
];

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isApiEditing, setIsApiEditing] = useState(false);
  const resetPersonalization = useUIStore((state) => state.resetPersonalization);
  const activeSettings = SETTINGS_TABS.find((tab) => tab.id === activeTab) || SETTINGS_TABS[0];
  const showSectionHeader = activeTab !== 'api' || !isApiEditing;

  return (
    <main className="module-workspace flex h-full min-h-0 flex-col overflow-hidden px-8 pb-8 pt-3 text-foreground" aria-label="工作台设置">
      <header className="mb-4 flex w-full shrink-0 items-center pt-3">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">设置</h1>
      </header>
      <div className="ui-module-panel flex min-h-0 min-w-0 w-full flex-1 overflow-hidden">
        <aside className="flex w-[200px] shrink-0 flex-col border-r-[var(--surface-panel-border-width)] border-[var(--surface-panel-border)] bg-sidebar p-3 text-sidebar-foreground">
        <nav aria-label="设置分类" className="space-y-2">
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
                  'h-8 w-full justify-start gap-3 px-3 text-left',
                  active
                    ? 'border-[var(--surface-panel-border-width)] border-[var(--action-secondary-border)] bg-[var(--action-secondary-bg)] text-[var(--action-secondary-foreground)] hover:bg-[var(--action-secondary-bg-hover)] hover:text-[var(--action-secondary-foreground)]'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon size={17} className="shrink-0" />
                <span className="min-w-0 truncate text-sm font-medium">{label}</span>
              </Button>
            );
          })}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-background text-foreground">
        {showSectionHeader && (
          <header className="flex min-h-20 shrink-0 items-center px-3">
            <div className="mx-auto flex w-full max-w-[800px] items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight">{activeSettings.label}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{activeSettings.description}，修改后自动保存在本机工作区。</p>
              </div>
              <div id="settings-header-actions" className="flex shrink-0 items-center justify-end gap-2">
                {activeTab === 'general' && (
                  <Button type="button" variant="ghost" onClick={resetPersonalization} className="h-8 gap-1.5 px-2 text-xs">
                    <RotateCcw size={14} />
                    恢复默认
                  </Button>
                )}
              </div>
            </div>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
          <div className="mx-auto w-full max-w-[800px]">
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'storage' && <StorageSettings />}
            {activeTab === 'api' && <ApiSettings onEditingChange={setIsApiEditing} />}
          </div>
        </div>
      </section>
      </div>
    </main>
  );
};
