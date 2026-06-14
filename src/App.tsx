import { ReactFlowProvider } from '@xyflow/react';
import { ArrowRight, Image as ImageIcon, LayoutTemplate, Sparkles, Video, Wand2 } from 'lucide-react';
import { AppShell } from './components/layout/AppShell';
import { Canvas } from './components/canvas/Canvas';
import { ImageGeneration } from './components/image-gen/ImageGeneration';
import { VideoGeneration } from './components/video-gen/VideoGeneration';
import { Inspiration } from './components/inspiration/Inspiration';
import { ProjectGallery } from './components/projects/ProjectGallery';
import { Ecommerce } from './components/ecommerce/Ecommerce';
import { AgentMarketplace } from './components/agents/AgentMarketplace';
import { NewChat } from './components/chat/NewChat';
import { WorkflowModal } from './components/modals/WorkflowModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { useUIStore } from './stores/useUIStore';
import { type ModuleType } from './stores/useUIStore';

const ModulePlaceholder = ({ title, description }: { title: string; description: string }) => (
  <div className="flex h-full w-full items-center justify-center bg-white px-6 text-center dark:bg-black">
    <div className="max-w-sm">
      <div className="mb-3 text-lg font-semibold text-slate-900">{title}</div>
      <p className="text-sm leading-6 text-slate-500">{description}</p>
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
    title: '魔法画布',
    description: '进入节点式创作工作台，串联文本、视频分析、智能分镜和模型路由。',
    module: 'magic-canvas',
    icon: Wand2,
    tag: '工作流画布',
  },
  {
    title: '图像生成',
    description: '输入提示词、参考图和比例参数，快速生成静态视觉资产。',
    module: 'image-gen',
    icon: ImageIcon,
    tag: '图片创作',
  },
  {
    title: '视频生成',
    description: '从主题脚本生成分镜、运镜、旁白和视频片段规划。',
    module: 'video-gen',
    icon: Video,
    tag: '视频工作台',
  },
  {
    title: '商品详情页',
    description: '上传商品素材，生成电商 KV、卖点文案和详情页视觉方案。',
    module: 'ecommerce',
    icon: LayoutTemplate,
    tag: '电商生成',
  },
];

const ToolsHub = () => {
  const setActiveModule = useUIStore((state) => state.setActiveModule);

  return (
    <div className="h-full overflow-y-auto bg-white px-12 py-10 dark:bg-black">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
            <Sparkles size={14} />
            使用工具
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">选择一个工具开始</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            常用功能会收在这里。点击卡片后进入原来的完整工作区，项目和对话历史仍保留在左侧。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {toolCards.map((card) => {
            const Icon = card.icon;

            return (
              <button
                key={card.title}
                onClick={() => setActiveModule(card.module)}
                className="group flex min-h-[220px] flex-col rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white">
                    <Icon size={21} strokeWidth={2} />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                    {card.tag}
                  </span>
                </div>

                <div className="mt-auto">
                  <h2 className="text-lg font-semibold text-slate-950">{card.title}</h2>
                  <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-500">{card.description}</p>
                  <div className="mt-5 flex items-center gap-2 text-sm font-medium text-slate-900">
                    打开工具
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </button>
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
    <ReactFlowProvider>
      <AppShell>
        {activeModule === 'new-chat' && <NewChat />}
        {activeModule === 'magic-canvas' && <Canvas />}
        {activeModule === 'image-gen' && <ImageGeneration />}
        {activeModule === 'video-gen' && <VideoGeneration />}
        {activeModule === 'inspiration' && <Inspiration />}
        {activeModule === 'projects' && <ProjectGallery />}
        {activeModule === 'ecommerce' && <Ecommerce />}
        {activeModule === 'agents' && <AgentMarketplace />}
        {activeModule === 'assets' && <Inspiration />}
        {activeModule === 'tools' && <ToolsHub />}
        {/* Render Canvas as fallback or specific placeholders for other modules */}
        {activeModule !== 'new-chat' && activeModule !== 'magic-canvas' && activeModule !== 'image-gen' && activeModule !== 'video-gen' && activeModule !== 'inspiration' && activeModule !== 'projects' && activeModule !== 'ecommerce' && activeModule !== 'agents' && activeModule !== 'assets' && activeModule !== 'tools' && (
          <ModulePlaceholder title="模块建设中" description="这个入口还没有接入具体页面。" />
        )}
        <WorkflowModal />
        <SettingsModal />
      </AppShell>
    </ReactFlowProvider>
  );
}

export default App;
