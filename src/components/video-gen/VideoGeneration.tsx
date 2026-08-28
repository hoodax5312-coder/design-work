import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Film,
  Layers3,
  Loader2,
  Music,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Sparkles,
  UserRound,
  UploadCloud,
  Wand2,
  X,
} from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { getSelectedModel, providerSupportsCategory, useProviderStore } from '../../stores/useProviderStore';
import { useUIStore } from '../../stores/useUIStore';
import { contentFeed, type GeneratedContentItem } from '../../services/contentFeed';
import { assetService, waitForTask } from '../../services/assetService';
import type { AssetSummary, ImportSession } from '../../types/asset.types';
import { ImportCenter } from '../assets/ImportCenter';
import { TaskDrawer } from '../assets/TaskDrawer';
import { Badge, Button, Card, Input, Select, Switch, Tabs, TabsList, TabsTrigger, Textarea } from '../ui';

type PipelineStageId = 'script' | 'storyboard' | 'image' | 'camera' | 'video';
type StageStatus = 'idle' | 'running' | 'done';

interface StoryboardShot {
  id: number;
  title: string;
  duration: number;
  narration: string;
  visualPrompt: string;
  cameraMove: string;
  status: StageStatus;
}

const RESOLUTION_OPTIONS = ['720P', '1080P'] as const;
const DURATION_OPTIONS = ['15s', '30s', '60s', '90s'] as const;
const RATIO_OPTIONS = ['16:9', '4:3', '1:1', '3:4', '9:16'];

const PIPELINE: Array<{ id: PipelineStageId; label: string; desc: string }> = [
  { id: 'script', label: '文案改写', desc: '主题扩写成视频脚本' },
  { id: 'storyboard', label: '自动分镜', desc: '拆分镜头与旁白' },
  { id: 'image', label: '画面生成', desc: '生成分镜图片提示词' },
  { id: 'camera', label: '智能运镜', desc: '规划推拉摇移与节奏' },
  { id: 'video', label: '视频生成', desc: '合成动态片段' },
];

const CAMERA_PRESETS = ['智能匹配', '缓慢推进', '横向平移', '轻微缩放', '手持纪录感', '静态构图'];
const STYLE_PRESETS = ['电影叙事', '国风动漫', '绘本童话', '知识科普', '情感短剧', '赛博幻想'];
const VOICE_PRESETS = ['温柔旁白', '纪录片解说', '儿童故事', '情绪短剧', '无配音'];

const createShots = (prompt: string, durationLabel: string): StoryboardShot[] => {
  const totalDuration = Number.parseInt(durationLabel, 10) || 30;
  const shotCount = totalDuration >= 60 ? 6 : totalDuration >= 30 ? 4 : 3;
  const seed = prompt.trim() || '一个关于勇气、选择与成长的短故事';
  const beats = [
    '开场建立世界观与主角处境',
    '冲突出现，主角必须做出选择',
    '行动升级，情绪和画面进入高潮',
    '结果揭示，主题落到观众记忆点',
    '补充细节，强化环境和人物关系',
    '收束结尾，留下短视频式回味',
  ];
  const moves = ['缓慢推进', '轻微环绕', '横向平移', '低角度推近', '景深拉焦', '稳定远景'];

  return Array.from({ length: shotCount }, (_, index) => ({
    id: index + 1,
    title: `镜头 ${String(index + 1).padStart(2, '0')}`,
    duration: Math.max(4, Math.round(totalDuration / shotCount)),
    narration: `${beats[index]}。围绕“${seed.slice(0, 38)}”展开，旁白保持短句、有画面感。`,
    visualPrompt: `Cinematic storyboard frame, ${seed}, ${beats[index]}, rich lighting, clear subject, professional composition, high detail`,
    cameraMove: moves[index % moves.length],
    status: 'idle',
  }));
};

export const VideoGeneration = () => {
  const [view, setView] = useState<'assets' | 'studio'>('assets');
  const setRightPanelOpen = useUIStore((state) => state.setRightPanelOpen);

  useEffect(() => {
    setRightPanelOpen(view === 'studio');
    return () => setRightPanelOpen(true);
  }, [setRightPanelOpen, view]);

  return view === 'assets'
    ? <VideoAssetLibrary onCreate={() => setView('studio')} />
    : <VideoStudio onOpenLibrary={() => setView('assets')} />;
};

const VideoStudio = ({ onOpenLibrary }: { onOpenLibrary: () => void }) => {
  const providers = useProviderStore((state) => state.providers);
  const activeProviderId = useProviderStore((state) => state.activeProviderIds.video);
  const provider = providers.find((item) => item.id === activeProviderId && providerSupportsCategory(item, 'video'));
  const videoModel = getSelectedModel(provider, 'video');
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState<(typeof RESOLUTION_OPTIONS)[number]>('1080P');
  const [duration, setDuration] = useState<(typeof DURATION_OPTIONS)[number]>('30s');
  const [ratio, setRatio] = useState('9:16');
  const [style, setStyle] = useState('电影叙事');
  const [cameraPreset, setCameraPreset] = useState('智能匹配');
  const [voice, setVoice] = useState('温柔旁白');
  const [smartAudio, setSmartAudio] = useState(true);
  const [stageStatus, setStageStatus] = useState<Record<PipelineStageId, StageStatus>>({
    script: 'idle',
    storyboard: 'idle',
    image: 'idle',
    camera: 'idle',
    video: 'idle',
  });
  const [shots, setShots] = useState<StoryboardShot[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedShotId, setSelectedShotId] = useState(1);

  const selectedShot = shots.find((shot) => shot.id === selectedShotId) || shots[0];
  const doneCount = Object.values(stageStatus).filter((status) => status === 'done').length;
  const progress = Math.round((doneCount / PIPELINE.length) * 100);

  const projectSummary = useMemo(() => {
    const shotDuration = shots.reduce((sum, shot) => sum + shot.duration, 0);
    return [
      { label: '分镜', value: shots.length ? `${shots.length} 个` : '待生成' },
      { label: '时长', value: shots.length ? `${shotDuration}s` : duration },
      { label: '规格', value: `${ratio} · ${resolution}` },
      { label: '风格', value: style },
    ];
  }, [duration, ratio, resolution, shots, style]);

  const runPipeline = async () => {
    setIsRunning(true);
    setShots([]);
    setStageStatus({ script: 'idle', storyboard: 'idle', image: 'idle', camera: 'idle', video: 'idle' });

    for (const stage of PIPELINE) {
      setStageStatus((prev) => ({ ...prev, [stage.id]: 'running' }));
      await new Promise((resolve) => window.setTimeout(resolve, 520));

      if (stage.id === 'storyboard') {
        const generatedShots = createShots(prompt, duration);
        setShots(generatedShots);
        setSelectedShotId(generatedShots[0]?.id || 1);
      }

      if (stage.id === 'camera') {
        setShots((prev) => prev.map((shot) => ({
          ...shot,
          cameraMove: cameraPreset === '智能匹配' ? shot.cameraMove : cameraPreset,
        })));
      }

      if (stage.id === 'video') {
        setShots((prev) => prev.map((shot) => ({ ...shot, status: 'done' })));
      }

      setStageStatus((prev) => ({ ...prev, [stage.id]: 'done' }));
    }

    setIsRunning(false);
  };

  const generateStoryboardOnly = () => {
    const generatedShots = createShots(prompt, duration);
    setShots(generatedShots);
    setSelectedShotId(generatedShots[0]?.id || 1);
    setStageStatus((prev) => ({ ...prev, script: 'done', storyboard: 'done' }));
  };

  const polishPrompt = () => {
    const base = prompt.trim() || '一个关于成长与选择的短故事';
    setPrompt(`${base}\n\n请用电影化短视频结构呈现：开场 3 秒建立冲突，中段强化情绪与动作，结尾留下清晰记忆点。画面需要有明确主体、环境层次和可执行的镜头调度。`);
  };

  const saveTemplate = () => {
    const template = {
      prompt,
      resolution,
      duration,
      ratio,
      style,
      cameraPreset,
      voice,
      smartAudio,
      model: videoModel,
      shots,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('design-work:video-template', JSON.stringify(template));
  };

  const updateShot = (id: number, patch: Partial<StoryboardShot>) => {
    setShots((prev) => prev.map((shot) => shot.id === id ? { ...shot, ...patch } : shot));
  };

  return (
    <div className="ui-module-frame module-workspace h-full w-full flex-col text-foreground md:flex-row">
      <aside className="ui-module-panel flex max-h-[46vh] w-full shrink-0 flex-col gap-3 overflow-y-auto p-4 md:max-h-none md:w-[390px]">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold">故事主题 / 视频大纲</label>
            <Button variant="link" size="sm"
              onClick={polishPrompt}
              className="h-auto text-xs"
            >
              <Sparkles size={13} />
              智能润色
            </Button>
          </div>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="输入故事主题、产品卖点、科普知识或短剧大纲..."
            className="h-36 text-sm leading-6"
          />
        </section>

        <div className="grid grid-cols-2 gap-3">
          <SelectControl label="视觉风格" value={style} options={STYLE_PRESETS} onChange={setStyle} />
          <SelectControl label="旁白音色" value={voice} options={VOICE_PRESETS} onChange={setVoice} />
          <SelectControl label="运镜策略" value={cameraPreset} options={CAMERA_PRESETS} onChange={setCameraPreset} />
          <SelectControl label="视频时长" value={duration} options={[...DURATION_OPTIONS]} onChange={(value) => setDuration(value as typeof duration)} />
        </div>

        <section>
          <label className="mb-2 block text-sm font-semibold">画面比例</label>
          <div className="grid grid-cols-5 gap-2">
            {RATIO_OPTIONS.map((option) => (
              <Button
                key={option}
                variant={ratio === option ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setRatio(option)}
                className="px-2"
              >
                {option}
              </Button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <InlineSelector label="清晰度" value={resolution} options={[...RESOLUTION_OPTIONS]} onChange={(value) => setResolution(value as typeof resolution)} />
          <Card padding="sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Music size={15} />
                智能配音
              </span>
              <Switch checked={smartAudio} onCheckedChange={setSmartAudio} aria-label="智能配音" />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{smartAudio ? `${voice} · 自动字幕` : '仅生成无声画面'}</p>
          </Card>
        </div>

        <Card padding="sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Layers3 size={16} />
              AI Story 流水线
            </h3>
            <Badge variant="secondary">{progress}%</Badge>
          </div>
          <div className="space-y-2">
            {PIPELINE.map((stage) => (
              <PipelineRow key={stage.id} stage={stage} status={stageStatus[stage.id]} />
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary"
            onClick={generateStoryboardOnly}
            disabled={!prompt.trim() || isRunning}
            className="h-8"
          >
            <Wand2 size={16} />
            拆分分镜
          </Button>
          <Button variant="primary"
            onClick={runPipeline}
            disabled={!prompt.trim() || isRunning}
            className="video-library-action h-8"
          >
            {isRunning ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
            一键生成
          </Button>
        </div>
      </aside>

      <main className="ui-module-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="ui-module-toolbar h-10 shrink-0 px-3">
          <div>
            <h2 className="text-sm font-bold">故事视频工作台</h2>
            <p className="text-xs text-muted-foreground">融合 AI Story 的脚本、分镜、运镜和视频生产流程</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm"
              onClick={onOpenLibrary}
            >
              <Film size={14} />
              <span className="hidden sm:inline">视频资产</span>
            </Button>
            <Button variant="secondary" size="sm"
              onClick={saveTemplate}
            >
              <Save size={14} />
              <span className="hidden sm:inline">保存模板</span>
            </Button>
            <Button variant="secondary" size="sm"
              onClick={() => {
                setShots([]);
                setStageStatus({ script: 'idle', storyboard: 'idle', image: 'idle', camera: 'idle', video: 'idle' });
              }}
            >
              <RefreshCcw size={14} />
              <span className="hidden sm:inline">重置</span>
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 overflow-y-auto p-4">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {projectSummary.map((item) => (
                <Card key={item.label} padding="sm">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-bold">{item.value}</p>
                </Card>
              ))}
            </div>

            {shots.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/35 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Film size={32} />
                </div>
                <h3 className="text-lg font-bold">从一个主题开始生成完整故事视频</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  这里会展示分镜、画面提示词、旁白、运镜和视频片段状态。先点击左侧“拆分分镜”或“一键生成”。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {shots.map((shot) => (
                  <Button
                    key={shot.id}
                    variant="ghost"
                    onClick={() => setSelectedShotId(shot.id)}
                    className={cn(
                      'h-auto w-full justify-start whitespace-normal rounded-lg border p-4 text-left',
                      selectedShotId === shot.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-accent',
                    )}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">
                          {String(shot.id).padStart(2, '0')}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold">{shot.title}</h3>
                          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock size={12} />
                            {shot.duration}s
                            <Camera size={12} />
                            {shot.cameraMove}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={shot.status} />
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{shot.narration}</p>
                  </Button>
                ))}
              </div>
            )}
          </section>

          <aside className="min-w-0 overflow-y-auto border-0 bg-card p-4 text-card-foreground">
            {selectedShot ? (
              <div className="space-y-4">
                <Card padding="none" className="overflow-hidden">
                  <div className="flex aspect-video items-center justify-center bg-foreground text-background">
                    <div className="text-center">
                      <Film className="mx-auto mb-3 opacity-70" size={36} />
                      <p className="text-sm font-bold">{selectedShot.title}</p>
                      <p className="mt-1 text-xs text-white/60">{selectedShot.cameraMove}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-border text-center">
                    <MiniAction icon={Play} label="预览" />
                    <MiniAction icon={RotateCcw} label="重绘" />
                    <MiniAction icon={Copy} label="复制" />
                  </div>
                </Card>

                <EditBlock
                  title="旁白"
                  value={selectedShot.narration}
                  onChange={(value) => updateShot(selectedShot.id, { narration: value })}
                />
                <EditBlock
                  title="画面提示词"
                  value={selectedShot.visualPrompt}
                  onChange={(value) => updateShot(selectedShot.id, { visualPrompt: value })}
                  rows={5}
                />
                <SelectControl
                  label="当前镜头运镜"
                  value={selectedShot.cameraMove}
                  options={CAMERA_PRESETS.filter((item) => item !== '智能匹配')}
                  onChange={(value) => updateShot(selectedShot.id, { cameraMove: value })}
                />

                <Card padding="sm">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <Settings2 size={15} />
                    生成服务配置
                  </h3>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>文案模型：OpenAI / Claude 兼容</p>
                    <p>图片模型：Stable Diffusion / DALL-E / Midjourney</p>
                    <p>视频模型：Runway / Pika 兼容队列</p>
                    <p>状态策略：失败重试、阶段回滚、批量生成</p>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                选择一个分镜后可编辑旁白、提示词和运镜
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

type VideoLibraryTab = 'assets' | 'projects';
type VideoProject = {
  id: string;
  code: string;
  title: string;
  author: string;
  views: string;
  thumbnail?: string;
};

const assetPreviewUrl = (asset?: { previewUrl?: string; userMetadata?: Record<string, unknown> }) => {
  const generatedUrl = asset?.userMetadata?.generatedUrl;
  return typeof generatedUrl === 'string' && generatedUrl ? generatedUrl : asset?.previewUrl;
};

const ProjectCover = ({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className: string;
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[var(--surface-control)] text-[var(--surface-control-foreground)]">
        <Film aria-hidden="true" size={28} />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
};

const getProjectMeta = (project: VideoProject, assets: AssetSummary[]) => {
  const projectNumber = Number(project.id.replace('project-', '')) || 1;
  const sourceAsset = assets[projectNumber - 1] || assets[0];
  const metadata = sourceAsset?.normalizedMetadata || {};
  const fileSizeValue = metadata.fileSize ?? metadata.size ?? metadata.bytes;
  const fileSize = typeof fileSizeValue === 'number' && fileSizeValue > 0
    ? fileSizeValue >= 1024 ** 3
      ? String((fileSizeValue / 1024 ** 3).toFixed(1)) + ' GB'
      : fileSizeValue >= 1024 ** 2
        ? String((fileSizeValue / 1024 ** 2).toFixed(1)) + ' MB'
        : String(Math.round(fileSizeValue / 1024)) + ' KB'
    : '—';
  const updatedAt = sourceAsset?.updatedAt || sourceAsset?.createdAt;

  return {
    projectNumber,
    sourceAsset,
    fileSize,
    updatedDate: updatedAt
      ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(updatedAt)
      : '—',
    duration: String(26 + projectNumber * 3) + 's',
  };
};

const PROJECT_SEEDS = [
  ['空心骑士', '@bakha', '940'],
  ['翡翠先锋', '@michelangelorobot1306', '182'],
  ['学院入门包', '@driftingcoffee1246', '43'],
  ['达尔哈雷尔瓶', '@flyinglamp1410', '16'],
  ['失踪的代理人', '@monrox', '174'],
  ['新来的女孩', '@alishaqantaar', '1.5万'],
  ['沙漠来客', '@northbound', '68'],
  ['霓虹余晖', '@nightframe', '239'],
] as const;

const VISUAL_PROJECT_SEEDS = [
  ['品牌视觉系统', '@designwork', '128'],
  ['春季产品发布', '@studio', '86'],
  ['社交媒体视觉套件', '@creative', '64'],
  ['电商主图方案', '@commerce', '42'],
  ['展览空间导视', '@atelier', '31'],
  ['移动端界面探索', '@product', '18'],
] as const;

const VideoLibraryTabs = ({
  activeTab,
  onAssets,
  onProjects,
}: {
  activeTab: VideoLibraryTab;
  onAssets: () => void;
  onProjects: () => void;
}) => (
  <Tabs value={activeTab} onValueChange={(value) => value === 'assets' ? onAssets() : onProjects()}>
    <TabsList aria-label="视频内容" className="h-8 gap-0 rounded-lg bg-muted p-0.5 shadow-none">
      <TabsTrigger value="assets" className="h-7 border-0 px-3 text-xs font-semibold shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">素材</TabsTrigger>
      <TabsTrigger value="projects" className="h-7 border-0 px-3 text-xs font-semibold shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">工程</TabsTrigger>
    </TabsList>
  </Tabs>
);

const VideoAssetLibrary = ({ onCreate }: { onCreate: () => void }) => {
  const [activeTab, setActiveTab] = useState<VideoLibraryTab>('assets');
  const [query, setQuery] = useState('');

  return (
    <div className="video-library-shell module-workspace flex h-full min-w-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="mx-16 flex h-14 shrink-0 items-center justify-between gap-4">
        <VideoLibraryTabs
          activeTab={activeTab}
          onAssets={() => setActiveTab('assets')}
          onProjects={() => setActiveTab('projects')}
        />
        <div className="relative ml-auto w-[240px] shrink-0">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={activeTab === 'assets' ? '搜索视频标题和描述…' : '搜索视频工程…'}
            className="h-8 border border-neutral-border bg-neutral-surface py-0 pl-9 pr-9 text-neutral-foreground placeholder:text-muted-foreground shadow-none focus-visible:ring-1 focus-visible:ring-neutral-border"
          />
          {query && <Button type="button" variant="ghost" size="iconSm" onClick={() => setQuery('')} aria-label="清空搜索" className="absolute right-0.5 top-1/2 h-6 w-6 -translate-y-1/2"><X size={13} /></Button>}
        </div>
      </header>
      <div className="mx-16 mb-0 flex min-h-0 flex-1 overflow-hidden rounded-xl bg-card p-2 text-card-foreground">
        {activeTab === 'assets'
          ? <VideoAssetCatalog query={query} />
          : <VideoProjectLibrary onCreate={onCreate} query={query} />}
      </div>
    </div>
  );
};

export const VideoProjectLibrary = ({ onCreate, query }: { onCreate: () => void; query: string }) => {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('project-1');
  const [isPlaying, setIsPlaying] = useState(false);
  const [projectType, setProjectType] = useState<'visual' | 'video'>('video');
  const [projectTypeOpen, setProjectTypeOpen] = useState(false);
  const [projectPanelOpen, setProjectPanelOpen] = useState(true);

  useEffect(() => {
    let active = true;
    assetService.list({ limit: 16 })
      .then((result) => {
        if (!active) return;
        const generatedAssets = contentFeed
          .list()
          .filter((item) => item.type === 'image' && Boolean(item.previewUrl))
          .map((item) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            description: item.description,
            primaryFolderId: null,
            favorite: false,
            rating: 0,
            status: 'generated',
            normalizedMetadata: {},
            userMetadata: { feedItem: true, ...item.metadata },
            createdAt: item.createdAt,
            importedAt: item.createdAt,
            updatedAt: item.createdAt,
            previewUrl: item.previewUrl,
            previewStatus: 'ready',
          } satisfies AssetSummary));
        setAssets([...generatedAssets, ...result.items]);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const projectSeeds = projectType === 'visual' ? VISUAL_PROJECT_SEEDS : PROJECT_SEEDS;
  const projects: VideoProject[] = projectSeeds.map(([title, author, views], index) => ({
    id: `project-${index + 1}`,
    code: `P-${String(index + 1).padStart(3, '0')}`,
    title,
    author,
    views,
    thumbnail: assetPreviewUrl(assets[index % Math.max(assets.length, 1)]),
  }));
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  const visibleProjects = projects.filter((project) => !normalizedQuery || `${project.title} ${project.author} ${project.code}`.toLocaleLowerCase('zh-CN').includes(normalizedQuery));
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || projects[0];
  const selectedProjectMeta = getProjectMeta(selectedProject, assets);
  const projectTypeLabel = projectType === 'visual' ? '视觉设计' : '视频工程';

  return (
    <main className={cn(
      'grid h-full w-full min-w-0 flex-1 grid-cols-1 gap-3 overflow-hidden text-foreground',
      projectPanelOpen && 'md:grid-cols-[260px_minmax(0,1fr)]',
    )}>
      {projectPanelOpen && <aside aria-label="视频工程列表" className="flex min-h-0 flex-col overflow-hidden bg-transparent">
        <header className="relative flex h-11 shrink-0 items-center px-4">
          <h1 className="text-sm font-semibold tracking-[-0.01em]">{projectTypeLabel}</h1>
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            onClick={() => setProjectTypeOpen((open) => !open)}
            aria-label="切换项目类型"
            aria-expanded={projectTypeOpen}
            aria-controls="project-type-menu"
            title="切换项目类型"
            className="ml-0.5 h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronDown size={14} className={cn('transition-transform', projectTypeOpen && 'rotate-180')} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            onClick={onCreate}
            aria-label="创建工程"
            title="创建工程"
            className="ml-auto h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Plus size={15} />
          </Button>
          {projectTypeOpen && (
            <div
              id="project-type-menu"
              role="menu"
              className="absolute left-4 top-10 z-30 w-36 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
            >
              {[
                { id: 'visual' as const, label: '视觉设计' },
                { id: 'video' as const, label: '视频工程' },
              ].map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  role="menuitemradio"
                  aria-checked={projectType === option.id}
                  onClick={() => {
                    setProjectType(option.id);
                    setSelectedProjectId('project-1');
                    setIsPlaying(false);
                    setProjectTypeOpen(false);
                  }}
                  className={cn(
                    'h-8 w-full justify-start px-2.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground',
                    projectType === option.id && 'bg-accent text-accent-foreground',
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
        </header>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          {visibleProjects.map((project) => {
            const isSelected = selectedProjectId === project.id;
            return (
              <Button key={project.id} type="button" variant="ghost" onClick={() => { setSelectedProjectId(project.id); setIsPlaying(false); }} className={cn('group relative block h-auto w-full overflow-hidden rounded-lg border border-border bg-background p-0 text-left shadow-none transition-[border-color] hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/30', isSelected && 'ring-2 ring-inset ring-foreground/80')}>
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[var(--surface-control)]">
                  <ProjectCover src={project.thumbnail} alt={`${project.title} 视频封面`} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
                  <h2 className="absolute inset-x-3 bottom-3 translate-y-1 truncate text-sm font-semibold text-white opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">{project.title}</h2>
                </div>
              </Button>
            );
          })}
          {!visibleProjects.length && <div className="px-2 py-8 text-center text-xs text-muted-foreground">没有匹配的视频工程</div>}
        </div>
      </aside>}
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg bg-background">
        <header className="flex h-11 min-w-0 shrink-0 items-center border-b border-border px-6">
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            onClick={() => setProjectPanelOpen((open) => !open)}
            aria-label={projectPanelOpen ? '收起项目列表' : '展开项目列表'}
            title={projectPanelOpen ? '收起项目列表' : '展开项目列表'}
            className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {projectPanelOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </Button>
          <span aria-hidden="true" className="mx-3 h-4 w-px bg-border" />
          <h2 className="shrink-0 text-sm font-semibold tracking-[-0.01em]">{selectedProject.title}</h2>
          <div className="ml-4 flex min-w-0 items-center gap-4 overflow-hidden whitespace-nowrap text-xs text-muted-foreground">
            <span>时间 {selectedProjectMeta.updatedDate}</span>
            <span>时长 {selectedProjectMeta.duration}</span>
            <span>分辨率 1920 × 1080</span>
            <span>文件大小 {selectedProjectMeta.fileSize}</span>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          {!visibleProjects.length ? <div className="flex h-full items-center justify-center text-xs text-muted-foreground">没有匹配的视频工程</div> : <ProjectMaterials project={selectedProject} assets={assets} isPlaying={isPlaying} onTogglePlayback={() => setIsPlaying((playing) => !playing)} />}
        </div>
      </section>
    </main>
  );
};

const ProjectMaterials = ({
  project,
  assets,
  isPlaying,
  onTogglePlayback,
}: {
  project: VideoProject;
  assets: AssetSummary[];
  isPlaying: boolean;
  onTogglePlayback: () => void;
}) => {
  const { projectNumber } = getProjectMeta(project, assets);
  const [activeDetailTab, setActiveDetailTab] = useState('character');
  const detailGroups = [
    { id: 'character', label: '角色', icon: UserRound, assets: assets.slice(0, 3) },
    { id: 'scene', label: '场景', icon: MapPin, assets: assets.slice(3, 6) },
    { id: 'storyboard', label: '分镜图', icon: Layers3, assets: assets.slice(6, 10) },
  ];
  const scriptPrompt = `以“${project.title}”为核心，用电影化短片结构展开。开场建立角色与环境，中段通过行动与镜头调度推进冲突，结尾保留清晰的情绪记忆点。`;

  return (
    <section aria-label={`${project.title} 工程详情`} className="min-h-0 min-w-0 w-full overflow-y-auto rounded-lg bg-background">
      <div className="w-full px-6 pb-5 pt-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[var(--surface-control)]">
          <ProjectCover src={project.thumbnail} alt={`${project.title} 视频封面`} className={cn('h-full w-full object-cover transition-transform duration-700', isPlaying && 'scale-[1.02]')} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/10" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onTogglePlayback}
            aria-label={isPlaying ? '暂停工程预览' : '播放工程预览'}
            className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white text-black shadow-xl hover:bg-white/90"
          >
            {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" className="translate-x-px" />}
          </Button>
          <div className="absolute inset-x-4 bottom-3 flex items-center gap-3 text-xs text-white/75">
            <span>{isPlaying ? '00:08' : '00:00'}</span>
            <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/25"><span className={cn('absolute inset-y-0 left-0 rounded-full bg-white transition-all duration-500', isPlaying ? 'w-[34%]' : 'w-0')} /></span>
            <span>00:{String(26 + projectNumber * 3).padStart(2, '0')}</span>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab}>
            <TabsList aria-label="工程内容分类" className="h-9 w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
              {detailGroups.map((group) => <TabsTrigger key={group.id} value={group.id} className="h-7 flex-1 px-3 text-xs">{group.label}</TabsTrigger>)}
              <TabsTrigger value="script" className="h-7 flex-1 px-3 text-xs">剧本</TabsTrigger>
            </TabsList>
          </Tabs>
          {activeDetailTab !== 'script' && detailGroups.filter((group) => group.id === activeDetailTab).map((group, groupIndex) => {
            const Icon = group.icon;
            return (
              <section key={group.id}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {(group.assets.length ? group.assets : Array.from({ length: groupIndex + 2 }, (_, index) => ({ id: `${group.id}-${index}`, title: `${group.label} ${index + 1}`, previewUrl: undefined }))).map((asset) => (
                    <article key={`${group.id}-${asset.id}`} className="overflow-hidden rounded-lg bg-muted/70">
                      <div className="relative aspect-video overflow-hidden bg-[#202020]">
                        {assetPreviewUrl(asset)
                          ? <img src={assetPreviewUrl(asset)} alt={asset.title} className="h-full w-full object-cover" />
                          : <Icon aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/35" size={20} />}
                      </div>
                      <p className="truncate px-2.5 py-2 text-xs font-medium">{asset.title}</p>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          {activeDetailTab === 'script' && <section className="grid gap-3 lg:grid-cols-2">
            <Card padding="md" className="border-0 bg-muted/65 shadow-none">
              <p className="text-xs font-semibold text-muted-foreground">剧本概要</p>
              <h3 className="mt-2 text-sm font-semibold">第一幕：角色进入世界</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">{scriptPrompt}</p>
            </Card>
            <Card padding="md" className="border-0 bg-muted/65 shadow-none">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-muted-foreground">视频提示词</p>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs"><Copy size={13} />复制</Button>
              </div>
              <p className="mt-2 text-xs leading-6 text-foreground/80">Cinematic short film, {project.title}, expressive character performance, layered environment, deliberate camera movement, restrained color palette, 16:9, high detail.</p>
            </Card>
          </section>}
        </div>
      </div>
    </section>
  );
};

export const VideoAssetCatalog = ({ query }: { query: string }) => {
  const [sort, setSort] = useState<'updated' | 'title'>('updated');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  const [activeTag, setActiveTag] = useState<'all' | 'new' | 'tag-2'>('all');
  const [items, setItems] = useState<GeneratedContentItem[]>(() => contentFeed.list().filter((item) => item.type === 'video'));
  const [libraryAssets, setLibraryAssets] = useState<AssetSummary[]>([]);
  const [dropZoneOpen, setDropZoneOpen] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [importSession, setImportSession] = useState<ImportSession | null>(null);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);
  const [importError, setImportError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLibraryAssets = useCallback(async () => {
    try {
      const result = await assetService.list({ type: 'video', limit: 100, sort: 'updatedAt' });
      setLibraryAssets(result.items);
    } catch (caught) {
      setImportError(caught instanceof Error ? caught.message : '视频素材加载失败');
    }
  }, []);

  useEffect(() => {
    const sync = () => setItems(contentFeed.list().filter((item) => item.type === 'video'));
    window.addEventListener('design-work:content-feed-updated', sync);
    return () => window.removeEventListener('design-work:content-feed-updated', sync);
  }, []);

  useEffect(() => {
    void loadLibraryAssets();
  }, [loadLibraryAssets]);

  const catalogItems = useMemo(() => {
    const persistedItems: GeneratedContentItem[] = libraryAssets.map((asset) => ({
      id: `asset-${asset.id}`,
      type: 'video',
      title: asset.title,
      description: asset.description,
      previewUrl: asset.previewUrl,
      createdAt: asset.createdAt,
      savedToAssets: true,
      metadata: { assetId: asset.id },
    }));
    const seen = new Set<string>();

    return [...persistedItems, ...items].filter((item) => {
      const key = item.previewUrl ? `preview:${item.previewUrl}` : `id:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items, libraryAssets]);

  const trackCommit = useCallback((taskId: string) => {
    setImportSession(null);
    setTasksOpen(true);
    setTaskRefreshKey((value) => value + 1);
    waitForTask(taskId)
      .then((task) => {
        setTaskRefreshKey((value) => value + 1);
        if (task.status === 'completed') {
          setNotice('视频素材导入完成');
          setDropZoneOpen(false);
          void loadLibraryAssets();
          window.setTimeout(() => setNotice(''), 2200);
          return;
        }
        setImportError(task.error?.message || '视频素材导入失败');
      })
      .catch((caught) => setImportError(caught instanceof Error ? caught.message : '视频素材导入失败'));
  }, [loadLibraryAssets]);

  const startImport = useCallback(async (paths: string[], autoConfirm = false) => {
    const task = await assetService.scan(paths);
    setTaskRefreshKey((value) => value + 1);
    setTasksOpen(true);
    const result = await waitForTask(task.id);
    if (result.status !== 'waiting_for_user') {
      throw new Error(result.error?.message || '文件扫描未完成');
    }
    const sessionId = (result.output as { sessionId?: string })?.sessionId;
    if (!sessionId) throw new Error('扫描任务未返回导入会话');
    const session = await assetService.importSession(sessionId);

    if (autoConfirm && !session.items.some((item) => item.duplicateAssetId || item.duplicateItemId)) {
      await assetService.saveImportDecisions(
        session.id,
        session.items.map((item) => ({
          itemId: item.id,
          decision: item.decision || 'import_new',
        })),
      );
      const commit = await assetService.confirmImport(session.id);
      setNotice(`已接收 ${session.items.length} 个视频，正在自动入库`);
      trackCommit(commit.id);
      return;
    }

    setImportSession(session);
    setTasksOpen(false);
  }, [trackCommit]);

  const importDroppedVideos = useCallback(async (files: File[]) => {
    const videoFiles = files.filter((file) => file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(file.name));
    if (!videoFiles.length) {
      setImportError('请选择或拖入视频文件');
      return;
    }

    try {
      setImportError('');
      const uploaded = await Promise.all(videoFiles.map((file) => assetService.dropImage(file)));
      await startImport(uploaded.map((item) => item.path), true);
    } catch (caught) {
      setImportError(caught instanceof Error ? caught.message : '视频素材导入失败');
    }
  }, [startImport]);

  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  const newItems = catalogItems.filter((item) => Date.now() - item.createdAt < 7 * 24 * 60 * 60 * 1000);
  const tagOptions = [
    { id: 'all' as const, label: '全部', count: catalogItems.length },
    { id: 'new' as const, label: '新的', count: newItems.length },
    { id: 'tag-2' as const, label: '标签2', count: 0 },
  ];
  const activeTagLabel = tagOptions.find((tag) => tag.id === activeTag)?.label || '全部';
  const taggedItems = activeTag === 'all' ? catalogItems : activeTag === 'new' ? newItems : [];
  const visibleItems = taggedItems
    .filter((item) => !normalizedQuery || `${item.title} ${item.description || ''}`.toLocaleLowerCase('zh-CN').includes(normalizedQuery))
    .sort((a, b) => sort === 'updated' ? b.createdAt - a.createdAt : a.title.localeCompare(b.title, 'zh-CN'));
  const sortOptions = [
    { id: 'updated' as const, label: '时间', hint: '最新优先' },
    { id: 'title' as const, label: '名称', hint: 'A–Z' },
  ];

  return (
    <>
      <div className="flex min-h-0 flex-1 gap-3 text-foreground">
      {filterPanelOpen && <aside aria-label="视频筛选" className="asset-filter-panel flex h-full w-[200px] shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
        <header className="flex h-11 shrink-0 items-center px-4">
          <h2 className="text-sm font-semibold tracking-[-0.01em]">筛选</h2>
        </header>
        <nav className="min-h-0 flex-1 overflow-y-auto px-4 pb-3" aria-label="视频标签筛选">
          <section className="px-0 py-1">
            <div className="flex h-8 items-center justify-between">
              <span className="text-[12px] font-semibold tracking-[0.04em] text-sidebar-foreground/70">标签</span>
              <Button type="button" variant="ghost" size="iconSm" aria-label="新建视频标签" className="-mr-3 h-7 w-7 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"><Plus size={14} /></Button>
            </div>
            <div className="space-y-1">
              {tagOptions.map((tag) => (
                <Button
                  key={tag.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTag(tag.id)}
                  aria-current={activeTag === tag.id ? 'page' : undefined}
                  className={cn(
                    '-mx-3 h-8 w-[calc(100%+1.5rem)] justify-between px-3 text-sm font-semibold hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    activeTag === tag.id && 'bg-sidebar-accent text-sidebar-accent-foreground',
                  )}
                >
                  <span>{tag.label}</span>
                  <span className={cn('w-6 text-right text-sm font-semibold tabular-nums text-sidebar-foreground/70', activeTag === tag.id && 'text-sidebar-accent-foreground/70')}>{tag.count}</span>
                </Button>
              ))}
            </div>
          </section>
        </nav>
      </aside>}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-background">
        <header className="relative flex h-11 shrink-0 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="iconSm" onClick={() => setFilterPanelOpen((open) => !open)} aria-label={filterPanelOpen ? '收起筛选' : '展开筛选'} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              {filterPanelOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </Button>
            <span aria-hidden="true" className="h-4 w-px bg-border" />
            <h1 className="text-sm font-semibold tracking-[-0.01em]">{activeTagLabel}</h1>
          </div>
          <div className="relative flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              onClick={() => {
                setImportError('');
                setDropZoneOpen((open) => !open);
              }}
              aria-label="导入素材"
              title="导入素材"
              aria-expanded={dropZoneOpen}
              className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Plus size={16} className={cn('transition-transform', dropZoneOpen && 'rotate-45')} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSortOpen((open) => !open)}
              aria-expanded={sortOpen}
              aria-controls="video-asset-sort-menu"
              className="h-8 gap-1 px-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              排序
              <ChevronDown size={13} className={cn('transition-transform', sortOpen && 'rotate-180')} />
            </Button>
            {sortOpen && (
              <div id="video-asset-sort-menu" className="absolute right-0 top-10 z-30 w-48 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
                {sortOptions.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSort(option.id);
                      setSortOpen(false);
                    }}
                    aria-pressed={sort === option.id}
                    className={cn(
                      'h-9 w-full justify-between hover:bg-accent hover:text-accent-foreground',
                      sort === option.id && 'bg-accent text-accent-foreground shadow-none',
                    )}
                  >
                    <span className="text-xs font-semibold">{option.label}</span>
                    <span className="text-xs font-medium text-muted-foreground">{option.hint}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </header>

        {dropZoneOpen && (
          <section
            className={cn(
              'mx-6 mt-6 flex min-h-[220px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 px-6 text-center transition-colors',
              draggingFiles && 'border-ring bg-accent',
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDraggingFiles(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setDraggingFiles(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDraggingFiles(false);
              const files = Array.from(event.dataTransfer.files);
              if (files.length) void importDroppedVideos(files);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.mov,.m4v,.webm,.avi,.mkv"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = '';
                if (files.length) void importDroppedVideos(files);
              }}
            />
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <UploadCloud size={21} />
            </span>
            <p className="text-sm font-semibold">点击选择视频，或将视频拖入此处</p>
            <p className="mt-1 text-xs text-muted-foreground">支持一次选择或拖入多个视频文件</p>
            {importError && <p role="alert" className="mt-2 text-xs font-medium text-red-500">{importError}</p>}
          </section>
        )}

        <section aria-label="视频资产列表" className="video-asset-stage relative flex min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {visibleItems.length ? (
          <div className="grid w-full content-start grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleItems.map((item) => (
              <Card key={item.id} padding="none" className="video-asset-card group overflow-hidden">
                <div className="relative aspect-video bg-gradient-to-br from-[#272727] to-[#080808]">
                  {item.previewUrl ? <video src={item.previewUrl} muted preload="metadata" className="h-full w-full object-cover" /> : <Film aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-600" size={30} />}
                </div>
                <div className="p-4">
                  <h2 className="truncate text-sm font-semibold">{item.title}</h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.description || '视频资产'}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
            <div className="m-auto flex max-w-sm flex-col items-center text-center">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-card text-foreground" aria-hidden="true"><Film size={25} /></div>
            <h1 className="video-archive-title text-2xl font-semibold">没有视频资产</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">调整搜索或标签筛选条件，已有视频不会被删除。</p>
          </div>
        )}
        </section>
      </main>
    </div>
    {importSession && (
      <ImportCenter
        session={importSession}
        onClose={() => setImportSession(null)}
        onCommitted={trackCommit}
      />
    )}
    <TaskDrawer open={tasksOpen} onClose={() => setTasksOpen(false)} refreshKey={taskRefreshKey} />
    {notice && (
      <div role="status" className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-xs font-medium text-background shadow-lg">
        {notice}
      </div>
    )}
    {importError && !dropZoneOpen && (
      <div role="alert" className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-md bg-red-600 px-4 py-2 text-xs font-medium text-white shadow-lg">
        {importError}
      </div>
    )}
    </>
  );
};

const SelectControl = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) => (
  <Select label={label} value={value} onChange={(event) => onChange(event.target.value)} options={options.map((option) => ({ value: option, label: option }))} />
);

const InlineSelector = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) => (
  <Card padding="sm">
    <p className="mb-3 text-sm font-semibold">{label}</p>
    <div className="flex rounded-md bg-muted p-1">
      {options.map((option) => (
        <Button
          key={option}
          variant={value === option ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onChange(option)}
          className="h-8 flex-1 px-2 text-xs"
        >
          {option}
        </Button>
      ))}
    </div>
  </Card>
);

const PipelineRow = ({
  stage,
  status,
}: {
  stage: { label: string; desc: string };
  status: StageStatus;
}) => (
  <div className="flex items-center gap-3 rounded-md bg-muted/55 px-3 py-2">
    <div className={cn(
      'flex h-7 w-7 items-center justify-center rounded-full',
      status === 'done'
        ? 'bg-emerald-500/10 text-emerald-500'
        : status === 'running'
          ? 'bg-primary/15 text-foreground'
          : 'bg-muted text-muted-foreground',
    )}>
      {status === 'done' ? <CheckCircle2 size={15} /> : status === 'running' ? <Loader2 className="animate-spin" size={15} /> : <Pause size={13} />}
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold">{stage.label}</p>
      <p className="truncate text-xs text-muted-foreground">{stage.desc}</p>
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: StageStatus }) => (
  <Badge variant={status === 'done' ? 'secondary' : status === 'running' ? 'default' : 'subtle'} className="text-xs">
    {status === 'done' ? '已完成' : status === 'running' ? '生成中' : '待生成'}
  </Badge>
);

const MiniAction = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <Button variant="ghost" size="sm" className="h-9 rounded-none text-xs">
    <Icon size={13} />
    {label}
  </Button>
);

const EditBlock = ({
  title,
  value,
  rows = 3,
  onChange,
}: {
  title: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
}) => (
  <Card padding="sm">
    <Textarea
      label={title}
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      className="text-xs leading-5"
    />
  </Card>
);
