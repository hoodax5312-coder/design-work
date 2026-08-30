import { useState } from 'react';
import {
  ArrowRight,
  Image as ImageIcon,
  Presentation,
  Scissors,
  Sparkles,
} from '@/lib/remixIconShim';
import { AppShell } from './components/layout/AppShell';
import { CanvasProjectPage } from './components/canvas/CanvasProjectPage';
import { ImageGeneration } from './components/image-gen/ImageGeneration';
import { VideoGeneration } from './components/video-gen/VideoGeneration';
import { PptGeneration } from './components/ppt-gen/PptGeneration';
import { AssetLibraryPage } from './components/assets/AssetLibraryPage';
import { QuickNotes } from './components/knowledge/QuickNotes';
import { PersonalSpace } from './components/spaces/PersonalSpace';
import { Ecommerce } from './components/ecommerce/Ecommerce';
import { ExportCenter, SourceCenter } from './components/delivery/DeliveryCenter';
import { WorkflowModal } from './components/modals/WorkflowModal';
import { SettingsPage } from './components/settings/SettingsPage';
import { useUIStore } from './stores/useUIStore';
import { type ModuleType } from './stores/useUIStore';
import { Badge, Card } from './components/ui';

const ModulePlaceholder = ({ title, description }: { title: string; description: string }) => (
  <div className="module-workspace flex h-full w-full items-center justify-center px-6 text-center">
    <div className="max-w-sm">
      <div className="mb-3 text-lg font-semibold text-foreground">{title}</div>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  </div>
);

const toolCards: Array<{
  title: string;
  description: string;
  module: ModuleType;
  icon: React.ElementType;
  tag: string;
}> = [
  {
    title: '电商详情页',
    description: '生成适配电商场景的商品详情内容与视觉素材。',
    module: 'ecommerce',
    icon: ImageIcon,
    tag: '电商工具',
  },
  {
    title: '抠图去背景',
    description: '快速分离主体与背景，获得干净透明的商品素材。',
    module: 'background-remove',
    icon: Scissors,
    tag: '图片处理',
  },
  {
    title: 'PPT 生成',
    description: '从主题和大纲生成可编辑的页面结构、叙事节奏与视觉规范。',
    module: 'ppt-gen',
    icon: Presentation,
    tag: '演示设计',
  },
  {
    title: '产品图精修',
    description: '优化产品图质感、光影和细节，统一视觉呈现。',
    module: 'product-retouch',
    icon: Sparkles,
    tag: '图片处理',
  },
];

const ToolsHub = () => {
  const setActiveModule = useUIStore((state) => state.setActiveModule);

  return (
    <div className="module-workspace h-full overflow-y-auto bg-[var(--module-workspace-bg,var(--background))] px-8 pb-4 pt-6 text-foreground sm:pb-6 lg:pb-8">
      <div className="mx-auto w-full max-w-[1080px]">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-[-0.02em]">工具</h1>
          <p className="mt-2 text-sm text-muted-foreground">选择工具开始创作，所有产出自动进入资产库。</p>
        </header>

        <div
          className="grid w-full gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}
        >
          {toolCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card role="button" tabIndex={0}
                key={card.title}
                onClick={() => setActiveModule(card.module)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setActiveModule(card.module); }}
                className="module-card group flex min-h-[200px] w-full cursor-pointer flex-col p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-foreground text-background transition-colors group-hover:bg-muted group-hover:text-foreground">
                    <Icon size={21} strokeWidth={2} />
                  </div>
                  <Badge variant="subtle" className="text-xs uppercase tracking-wide">{card.tag}</Badge>
                </div>

                <div className="mt-auto">
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{card.title}</h3>
                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-muted-foreground">{card.description}</p>
                  <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-foreground">
                    打开工具
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const AssetWorkspace = () => {
  const [section, setSection] = useState<'assets' | 'prompts' | 'notes'>('assets');
  return (
    <div className="module-workspace flex h-full min-h-0 flex-col bg-[var(--module-workspace-bg,var(--background))]">
      <div className="ui-module-toolbar mx-3 flex h-14 shrink-0 items-center justify-between border-0 px-0 shadow-none">
        <div role="tablist" aria-label="资产内容" className="flex h-8 items-center gap-1">
          {([
            ['assets', '素材'],
            ['prompts', '词库'],
            ['notes', '笔记'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={section === value}
              data-state={section === value ? 'active' : 'inactive'}
              onClick={() => setSection(value)}
              className="flex h-8 items-center rounded-md border-0 bg-transparent px-4 py-0 text-sm font-medium text-muted-foreground shadow-none transition-colors focus-visible:ring-offset-0 data-[state=inactive]:hover:text-foreground data-[state=active]:!bg-[var(--surface-control)] data-[state=active]:!text-[var(--surface-control-foreground)] data-[state=active]:!shadow-none"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-3 mb-3 min-h-0 flex-1 overflow-hidden">
        {section === 'assets' && <AssetLibraryPage showSourceTabs={false} showSearch={false} flushLayout />}
        {section === 'prompts' && <QuickNotes />}
        {section === 'notes' && <PersonalSpace embedded />}
      </div>
    </div>
  );
};

function App() {
  const { activeModule } = useUIStore();

  return (
    <AppShell>
        {activeModule === 'magic-canvas' && <CanvasProjectPage />}
        <div className={activeModule === 'image-gen' ? 'contents' : 'hidden'}>
          <ImageGeneration />
        </div>
        {activeModule === 'ppt-gen' && <PptGeneration />}
        <div className={activeModule === 'video-gen' ? 'contents' : 'hidden'}>
          <VideoGeneration />
        </div>
        {activeModule === 'projects' && <SourceCenter initialSection="documents" />}
        {activeModule === 'ecommerce' && <Ecommerce />}
        {activeModule === 'background-remove' && <ModulePlaceholder title="抠图去背景" description="上传图片后即可进行主体分离与背景移除。" />}
        {activeModule === 'product-retouch' && <ModulePlaceholder title="产品图精修" description="上传产品图后即可进行光影、质感与细节优化。" />}
        {activeModule === 'assets' && <AssetWorkspace />}
        {activeModule === 'cases' && <AssetLibraryPage initialSource="online" showSourceTabs={false} showSearch />}
        {activeModule === 'tools' && <ToolsHub />}
        {activeModule === 'sources' && <SourceCenter />}
        {activeModule === 'exports' && <ExportCenter />}
        {activeModule === 'settings' && <SettingsPage />}
        {/* Render Canvas as fallback or specific placeholders for other modules */}
        {activeModule !== 'magic-canvas' && activeModule !== 'image-gen' && activeModule !== 'ppt-gen' && activeModule !== 'video-gen' && activeModule !== 'projects' && activeModule !== 'ecommerce' && activeModule !== 'background-remove' && activeModule !== 'product-retouch' && activeModule !== 'assets' && activeModule !== 'cases' && activeModule !== 'tools' && activeModule !== 'sources' && activeModule !== 'exports' && activeModule !== 'settings' && (
          <ModulePlaceholder title="模块建设中" description="这个入口还没有接入具体页面。" />
        )}
        <WorkflowModal />
    </AppShell>
  );
}

export default App;
