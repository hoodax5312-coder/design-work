import { useEffect, useState } from 'react';
import { Settings, Key, Database, Check } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { GeneralSettings, ApiSettings, StorageSettings } from './settings';

type TabType = 'general' | 'storage' | 'api';

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: '通用', icon: Settings },
  { id: 'storage', label: '数据存储', icon: Database },
  { id: 'api', label: 'API 与模型', icon: Key },
];

export const SettingsModal = () => {
  const { modalOpen, closeModal } = useUIStore();
  const [activeTab, setActiveTab] = useState<TabType>('general');

  useEffect(() => {
    if (modalOpen !== 'settings') return;
    setActiveTab('general');
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closeModal, modalOpen]);

  if (modalOpen !== 'settings') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-[#090a0b]/55 backdrop-blur-[3px]"
        onClick={closeModal}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative flex h-[100dvh] w-screen flex-col overflow-hidden rounded-none border border-black/[0.05] bg-background text-foreground shadow-lg dark:border-white/[0.07] sm:h-[min(760px,calc(100dvh-32px))] sm:w-[min(1200px,calc(100vw-32px))] sm:flex-row sm:rounded-lg"
      >
        <h2 id="settings-title" className="sr-only">工作台设置</h2>
        <div className="flex w-full shrink-0 flex-col border-b border-black/[0.045] bg-muted/30 p-3 dark:border-white/[0.06] sm:w-[240px] sm:border-b-0 sm:border-r sm:p-4">
          <nav aria-label="设置分类" className="grid grid-cols-3 gap-1 sm:block sm:space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <Button type="button" variant="ghost"
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={cn(
                  'group h-10 w-full justify-center gap-1.5 px-2 text-left text-xs sm:justify-start sm:gap-3 sm:px-3 sm:text-[12px]',
                  activeTab === id
                    ? 'bg-black/[0.055] text-foreground shadow-none dark:bg-white/[0.08]'
                    : 'text-muted-foreground hover:bg-black/[0.035] hover:text-foreground dark:hover:bg-white/[0.055]'
                )}
              >
                <Icon size={16} strokeWidth={activeTab === id ? 2.2 : 1.8} />
                <span className="truncate sm:flex-1">{label}</span>
              </Button>
            ))}
          </nav>
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <div className="flex h-14 shrink-0 items-center border-b border-black/[0.045] px-5 dark:border-white/[0.06]">
            <div>
              <h3 className="text-[14px] font-semibold tracking-[-0.015em]">{TABS.find((t) => t.id === activeTab)?.label}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">修改后将自动保存在本机工作区</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-background p-4 sm:p-8">
            {activeTab === 'general' && (
              <GeneralSettings />
            )}
            {activeTab === 'api' && (
              <ApiSettings />
            )}
            {activeTab === 'storage' && <StorageSettings />}
          </div>

          <div className="flex h-[60px] shrink-0 items-center justify-between border-t border-black/[0.045] bg-background px-5 dark:border-white/[0.06]">
            <span className="text-xs text-muted-foreground">按 Esc 可关闭</span>
            <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={closeModal}>
              取消
            </Button>
            <Button variant="primary" size="sm" onClick={closeModal} className="bg-foreground text-background hover:bg-foreground/85"><Check size={13} strokeWidth={2.5} /> 完成</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
