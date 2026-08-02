import {
  ArrowRight,
  Boxes,
  Film,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  Presentation,
  Sparkles,
  Video,
} from 'lucide-react';
import { AppShell } from './components/layout/AppShell';
import { Canvas } from './components/canvas/Canvas';
import { ImageGeneration } from './components/image-gen/ImageGeneration';
import { VideoGeneration } from './components/video-gen/VideoGeneration';
import { PptGeneration } from './components/ppt-gen/PptGeneration';
import { AssetLibraryPage } from './components/assets/AssetLibraryPage';
import { PersonalSpace } from './components/spaces/PersonalSpace';
import { Ecommerce } from './components/ecommerce/Ecommerce';
import { ExportCenter, SourceCenter } from './components/delivery/DeliveryCenter';
import { WorkflowModal } from './components/modals/WorkflowModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { useUIStore } from './stores/useUIStore';
import { type ModuleType } from './stores/useUIStore';
import { Badge, Button, Card } from './components/ui';

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
    title: '无限画板',
    description: '在无限空间中组织灵感、图像、分镜和生成节点，组装完整创作流。',
    module: 'magic-canvas',
    icon: InfinityIcon,
    tag: '创作中枢',
  },
  {
    title: '图像生成',
    description: '输入提示词、参考图和比例参数，快速生成静态视觉资产。',
    module: 'image-gen',
    icon: ImageIcon,
    tag: '图片创作',
  },
  {
    title: 'PPT 生成',
    description: '从主题和大纲生成可编辑的页面结构、叙事节奏与视觉规范。',
    module: 'ppt-gen',
    icon: Presentation,
    tag: '演示设计',
  },
  {
    title: '视频生成',
    description: '从主题脚本生成分镜、运镜、旁白和视频片段规划。',
    module: 'video-gen',
    icon: Video,
    tag: '视频工作台',
  },
  {
    title: '资产库',
    description: '统一管理图片、视频、提示词、参考稿和项目产出，支持标签与收藏。',
    module: 'assets',
    icon: Boxes,
    tag: '创意资产',
  },
];

const ToolsHub = () => {
  const setActiveModule = useUIStore((state) => state.setActiveModule);

  return (
    <div className="module-workspace h-full overflow-y-auto p-4 text-foreground sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="relative mb-6 border-b border-black/[0.06] px-1 pb-6 dark:border-white/[0.08]">
          <div className="relative mb-4 inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Sparkles size={14} />
            AI applications
          </div>
          <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em]">
            让 AI 帮你整理、理解和再利用设计资产。
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            图片、视频、演示文稿和无限画板都是资产库的辅助能力，所有生成结果都会回到资产库继续归档与分享。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" variant="primary" onClick={() => setActiveModule('assets')} className="h-8">
              <Boxes size={16} /> 返回资产库
            </Button>
            <Button type="button" variant="secondary" onClick={() => setActiveModule('magic-canvas')} className="h-8">
              <InfinityIcon size={16} /> 打开无限画板
            </Button>
          </div>
        </div>

        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Create</div>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">辅助创作能力</h2>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><Film size={14} /> 所有产出自动进入资产库</div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {toolCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card role="button" tabIndex={0}
                key={card.title}
                onClick={() => setActiveModule(card.module)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setActiveModule(card.module); }}
                className="module-card group flex min-h-[200px] cursor-pointer flex-col rounded-lg p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

function App() {
  const { activeModule } = useUIStore();

  return (
    <AppShell>
        {activeModule === 'magic-canvas' && <Canvas />}
        {activeModule === 'image-gen' && <ImageGeneration />}
        {activeModule === 'ppt-gen' && <PptGeneration />}
        {activeModule === 'video-gen' && <VideoGeneration />}
        {activeModule === 'projects' && <PersonalSpace />}
        {activeModule === 'ecommerce' && <Ecommerce />}
        {activeModule === 'assets' && <AssetLibraryPage />}
        {activeModule === 'tools' && <ToolsHub />}
        {activeModule === 'sources' && <SourceCenter />}
        {activeModule === 'exports' && <ExportCenter />}
        {/* Render Canvas as fallback or specific placeholders for other modules */}
        {activeModule !== 'magic-canvas' && activeModule !== 'image-gen' && activeModule !== 'ppt-gen' && activeModule !== 'video-gen' && activeModule !== 'projects' && activeModule !== 'ecommerce' && activeModule !== 'assets' && activeModule !== 'tools' && activeModule !== 'sources' && activeModule !== 'exports' && (
          <ModulePlaceholder title="模块建设中" description="这个入口还没有接入具体页面。" />
        )}
        <WorkflowModal />
        <SettingsModal />
    </AppShell>
  );
}

export default App;
