import { useMemo, useState } from 'react';
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
  Pause,
  Play,
  RefreshCcw,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

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
      shots,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('mboard:video-template', JSON.stringify(template));
  };

  const updateShot = (id: number, patch: Partial<StoryboardShot>) => {
    setShots((prev) => prev.map((shot) => shot.id === id ? { ...shot, ...patch } : shot));
  };

  return (
    <div className="flex h-full w-full gap-2 bg-white p-2 text-slate-900 transition-colors dark:bg-black dark:text-zinc-100">
      <aside className="flex w-[390px] shrink-0 flex-col gap-4 overflow-y-auto rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-900">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold text-[#1d2531] dark:text-slate-200">故事主题 / 视频大纲</label>
            <button
              onClick={polishPrompt}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400"
            >
              <Sparkles size={13} />
              智能润色
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="输入故事主题、产品卖点、科普知识或短剧大纲..."
            className="h-36 w-full resize-none rounded-xl border border-slate-200 bg-[#f7f9fa] px-3 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 dark:border-zinc-800 dark:bg-black dark:placeholder:text-zinc-600"
          />
        </section>

        <div className="grid grid-cols-2 gap-3">
          <SelectControl label="视觉风格" value={style} options={STYLE_PRESETS} onChange={setStyle} />
          <SelectControl label="旁白音色" value={voice} options={VOICE_PRESETS} onChange={setVoice} />
          <SelectControl label="运镜策略" value={cameraPreset} options={CAMERA_PRESETS} onChange={setCameraPreset} />
          <SelectControl label="视频时长" value={duration} options={[...DURATION_OPTIONS]} onChange={(value) => setDuration(value as typeof duration)} />
        </div>

        <section>
          <label className="mb-2 block text-sm font-semibold text-[#1d2531] dark:text-slate-200">画面比例</label>
          <div className="grid grid-cols-5 gap-2">
            {RATIO_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setRatio(option)}
                className={cn(
                  'rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
                  ratio === option
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-500/50 dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-white/10',
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <InlineSelector label="清晰度" value={resolution} options={[...RESOLUTION_OPTIONS]} onChange={(value) => setResolution(value as typeof resolution)} />
          <div className="rounded-xl border border-slate-200 p-3 dark:border-zinc-800">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-zinc-300">
                <Music size={15} />
                智能配音
              </span>
              <button
                onClick={() => setSmartAudio(!smartAudio)}
                className={cn('relative h-5 w-10 rounded-full transition-colors', smartAudio ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-zinc-700')}
              >
                <span className={cn('absolute top-1 h-3 w-3 rounded-full bg-white transition-all', smartAudio ? 'left-6' : 'left-1')} />
              </button>
            </div>
            <p className="text-xs leading-5 text-slate-500 dark:text-zinc-500">{smartAudio ? `${voice} · 自动字幕` : '仅生成无声画面'}</p>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 p-3 dark:border-zinc-800">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Layers3 size={16} />
              AI Story 流水线
            </h3>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{progress}%</span>
          </div>
          <div className="space-y-2">
            {PIPELINE.map((stage) => (
              <PipelineRow key={stage.id} stage={stage} status={stageStatus[stage.id]} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={generateStoryboardOnly}
            disabled={!prompt.trim() || isRunning}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-white/10"
          >
            <Wand2 size={16} />
            拆分分镜
          </button>
          <button
            onClick={runPipeline}
            disabled={!prompt.trim() || isRunning}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
          >
            {isRunning ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
            一键生成
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm dark:bg-zinc-900">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 px-5 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-bold">故事视频工作台</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-500">融合 AI Story 的脚本、分镜、运镜和视频生产流程</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveTemplate}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-white/10"
            >
              <Save size={14} />
              保存模板
            </button>
            <button
              onClick={() => {
                setShots([]);
                setStageStatus({ script: 'idle', storyboard: 'idle', image: 'idle', camera: 'idle', video: 'idle' });
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-white/10"
            >
              <RefreshCcw size={14} />
              重置
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-0">
          <section className="min-w-0 overflow-y-auto p-5">
            <div className="mb-4 grid grid-cols-4 gap-3">
              {projectSummary.map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-[#f7f9fa] p-3 dark:border-zinc-800 dark:bg-black">
                  <p className="text-xs text-slate-500 dark:text-zinc-500">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>

            {shots.length === 0 ? (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-[#f7f9fa] text-center dark:border-zinc-800 dark:bg-black">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Film size={32} />
                </div>
                <h3 className="text-lg font-bold">从一个主题开始生成完整故事视频</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-zinc-500">
                  这里会展示分镜、画面提示词、旁白、运镜和视频片段状态。先点击左侧“拆分分镜”或“一键生成”。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {shots.map((shot) => (
                  <button
                    key={shot.id}
                    onClick={() => setSelectedShotId(shot.id)}
                    className={cn(
                      'w-full rounded-xl border p-4 text-left transition-colors',
                      selectedShotId === shot.id
                        ? 'border-indigo-400 bg-indigo-50/70 dark:border-indigo-500/50 dark:bg-indigo-500/10'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-white/5',
                    )}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-black">
                          {String(shot.id).padStart(2, '0')}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold">{shot.title}</h3>
                          <p className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                            <Clock size={12} />
                            {shot.duration}s
                            <Camera size={12} />
                            {shot.cameraMove}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={shot.status} />
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-slate-600 dark:text-zinc-400">{shot.narration}</p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="min-w-0 overflow-y-auto border-l border-slate-200 bg-[#f7f9fa] p-4 dark:border-zinc-800 dark:bg-black">
            {selectedShot ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
                    <div className="text-center">
                      <Film className="mx-auto mb-3 opacity-70" size={36} />
                      <p className="text-sm font-bold">{selectedShot.title}</p>
                      <p className="mt-1 text-xs text-white/60">{selectedShot.cameraMove}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-slate-200 text-center dark:divide-zinc-800">
                    <MiniAction icon={Play} label="预览" />
                    <MiniAction icon={RotateCcw} label="重绘" />
                    <MiniAction icon={Copy} label="复制" />
                  </div>
                </div>

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

                <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <Settings2 size={15} />
                    生成服务配置
                  </h3>
                  <div className="space-y-2 text-xs text-slate-500 dark:text-zinc-500">
                    <p>文案模型：OpenAI / Claude 兼容</p>
                    <p>图片模型：Stable Diffusion / DALL-E / Midjourney</p>
                    <p>视频模型：Runway / Pika 兼容队列</p>
                    <p>状态策略：失败重试、阶段回滚、批量生成</p>
                  </div>
                </section>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
                选择一个分镜后可编辑旁白、提示词和运镜
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
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
  <label className="block">
    <span className="mb-2 block text-xs font-semibold text-slate-500 dark:text-zinc-400">{label}</span>
    <span className="relative block">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm outline-none focus:border-indigo-400 dark:border-zinc-800 dark:bg-black"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
    </span>
  </label>
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
  <div className="rounded-xl border border-slate-200 p-3 dark:border-zinc-800">
    <p className="mb-3 text-sm font-semibold text-slate-600 dark:text-zinc-300">{label}</p>
    <div className="flex rounded-lg bg-[#f7f9fa] p-1 dark:bg-zinc-800">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={cn(
            'flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors',
            value === option
              ? 'bg-white text-[#1d2531] shadow-sm dark:bg-zinc-700 dark:text-white'
              : 'text-slate-500 dark:text-zinc-400',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  </div>
);

const PipelineRow = ({
  stage,
  status,
}: {
  stage: { label: string; desc: string };
  status: StageStatus;
}) => (
  <div className="flex items-center gap-3 rounded-lg bg-[#f7f9fa] px-3 py-2 dark:bg-black">
    <div className={cn(
      'flex h-7 w-7 items-center justify-center rounded-full',
      status === 'done'
        ? 'bg-emerald-500/10 text-emerald-500'
        : status === 'running'
          ? 'bg-indigo-500/10 text-indigo-500'
          : 'bg-slate-200 text-slate-400 dark:bg-zinc-800',
    )}>
      {status === 'done' ? <CheckCircle2 size={15} /> : status === 'running' ? <Loader2 className="animate-spin" size={15} /> : <Pause size={13} />}
    </div>
    <div className="min-w-0">
      <p className="text-xs font-bold">{stage.label}</p>
      <p className="truncate text-[11px] text-slate-500 dark:text-zinc-500">{stage.desc}</p>
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: StageStatus }) => (
  <span className={cn(
    'rounded-full px-2 py-1 text-[11px] font-bold',
    status === 'done'
      ? 'bg-emerald-500/10 text-emerald-500'
      : status === 'running'
        ? 'bg-indigo-500/10 text-indigo-500'
        : 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400',
  )}>
    {status === 'done' ? '已完成' : status === 'running' ? '生成中' : '待生成'}
  </span>
);

const MiniAction = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <button className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white">
    <Icon size={13} />
    {label}
  </button>
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
  <label className="block rounded-xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
    <span className="mb-2 block text-sm font-bold">{title}</span>
    <textarea
      value={value}
      rows={rows}
      onChange={(event) => onChange(event.target.value)}
      className="w-full resize-none rounded-lg border border-slate-200 bg-[#f7f9fa] px-3 py-2 text-xs leading-5 outline-none focus:border-indigo-400 dark:border-zinc-800 dark:bg-black"
    />
  </label>
);
