import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  BookmarkPlus,
  Check,
  ChevronDown,
  Clock3,
  Download,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { generateProviderImage, generateProviderVideo } from '../../services/providerService';
import {
  getActiveProvider,
  getConfiguredModels,
  modelSupportsCategory,
  getSelectedModel,
  useProviderStore,
} from '../../stores/useProviderStore';
import { useUIStore } from '../../stores/useUIStore';
import { assetService } from '../../services/assetService';
import { contentFeed } from '../../services/contentFeed';
import { workspaceCacheService } from '../../services/workspaceCacheService';
import { cn } from '../../lib/utils';
import {
  Button,
  Input,
  Textarea,
} from '../ui';

const RESOLUTION_OPTIONS = ['1k', '2k', '4k'] as const;
const QUALITY_OPTIONS = ['低', '中', '高'] as const;
const VIDEO_CLARITY_OPTIONS = ['480P', '720P', '1080P'] as const;
const VIDEO_DURATION_OPTIONS = [5, 10, 15] as const;
const GENERATION_COUNT_OPTIONS = [1, 2, 3, 4] as const;
const RATIO_OPTIONS = [
  { value: '1:1', width: 18, height: 18 },
  { value: '2:3', width: 14, height: 21 },
  { value: '3:2', width: 23, height: 15 },
  { value: '4:5', width: 18, height: 22 },
  { value: '5:4', width: 23, height: 18 },
  { value: '16:9', width: 26, height: 15 },
  { value: '9:16', width: 13, height: 23 },
  { value: '21:9', width: 28, height: 12 },
  { value: '3:4', width: 17, height: 22 },
  { value: '4:3', width: 23, height: 17 },
  { value: '自适应', width: 18, height: 18, adaptive: true },
] as const;
const VIDEO_RATIO_OPTIONS = [
  { value: '16:9', label: '横屏', resolutionLabel: '1280×720', width: 26, height: 15 },
  { value: '9:16', label: '竖屏', resolutionLabel: '720×1280', width: 13, height: 23 },
  { value: '1:1', label: '方形', resolutionLabel: '1024×1024', width: 18, height: 18 },
  { value: '7:4', label: '宽屏', resolutionLabel: '1792×1024', width: 26, height: 15 },
  { value: '4:7', label: '长图', resolutionLabel: '1024×1792', width: 13, height: 23 },
  { value: '自适应', label: '自动', resolutionLabel: '', width: 18, height: 18, adaptive: true },
] as const;

const segmentedOptionClass = (selected: boolean) => cn(
  'h-8 w-full border-0 px-1 text-xs shadow-none ring-0',
  'hover:bg-black/[0.04] dark:hover:bg-white/[0.08]',
  selected && 'bg-black/[0.07] text-foreground hover:bg-black/[0.07] dark:bg-white/[0.14] dark:hover:bg-white/[0.14]'
);

interface ReferenceImage {
  id: string;
  file: File;
  url: string;
}

interface GenerationRecord {
  id: string;
  prompt: string;
  createdAt: string;
  model: string;
  ratio: string;
  resolution: string;
  quality: string;
  duration?: number;
  outputs: string[];
  mode?: 'image' | 'video';
}

interface GenerationHistoryCache {
  image: GenerationRecord[];
  video: GenerationRecord[];
}

const feedHistory = (): GenerationHistoryCache => {
  const cache: GenerationHistoryCache = { image: [], video: [] };
  contentFeed.list().forEach((item) => {
    if (item.type !== 'image' && item.type !== 'video') return;
    const metadata = item.metadata || {};
    cache[item.type].push({
      id: item.id,
      prompt: String(metadata.prompt || item.description || ''),
      createdAt: new Date(item.createdAt).toISOString(),
      model: String(metadata.model || ''),
      ratio: String(metadata.ratio || '16:9'),
      resolution: String(metadata.resolution || (item.type === 'video' ? '480p' : '2k')),
      quality: String(metadata.quality || '中'),
      duration: typeof metadata.duration === 'number' ? metadata.duration : undefined,
      outputs: item.previewUrl ? [item.previewUrl] : [],
      mode: item.type,
    });
  });
  return cache;
};

const isImage = (file: File) => file.type.startsWith('image/');

const imageSizeForRatio = (ratio: string, model: string) => {
  const isDallE3 = model.toLowerCase().includes('dall-e-3');
  if (['2:3', '4:5', '3:4', '9:16'].includes(ratio)) return isDallE3 ? '1024x1792' : '1024x1536';
  if (['3:2', '5:4', '4:3', '16:9', '21:9'].includes(ratio)) return isDallE3 ? '1792x1024' : '1536x1024';
  return '1024x1024';
};

const videoResolutionForRatio = (ratio: string) => {
  if (ratio === '9:16') return '320x480';
  if (ratio === '4:7') return '360x480';
  if (ratio === '1:1' || ratio === '自适应') return '480x480';
  return '480x320';
};

const formatGenerationTime = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(new Date(value));

export const ImageGeneration = () => {
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('16:9');
  const [resolution, setResolution] = useState<(typeof RESOLUTION_OPTIONS)[number]>('2k');
  const [quality, setQuality] = useState<(typeof QUALITY_OPTIONS)[number]>('中');
  const [videoClarity, setVideoClarity] = useState<(typeof VIDEO_CLARITY_OPTIONS)[number]>('720P');
  const [videoDuration, setVideoDuration] = useState<(typeof VIDEO_DURATION_OPTIONS)[number] | 'custom'>(5);
  const [customVideoDuration, setCustomVideoDuration] = useState(20);
  const [modelPanelOpen, setModelPanelOpen] = useState(false);
  const [parameterPanelOpen, setParameterPanelOpen] = useState(false);
  const [generationCountPanelOpen, setGenerationCountPanelOpen] = useState(false);
  const [videoDurationPanelOpen, setVideoDurationPanelOpen] = useState(false);
  const [generationCount, setGenerationCount] = useState<(typeof GENERATION_COUNT_OPTIONS)[number] | 'custom'>(1);
  const [customGenerationCount, setCustomGenerationCount] = useState(5);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [referenceVideo, setReferenceVideo] = useState<File | null>(null);
  const [referenceAudio, setReferenceAudio] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const historyCacheRef = useRef<GenerationHistoryCache>({ image: [], video: [] });
  const historyLoadedRef = useRef(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [assetNotice, setAssetNotice] = useState('');
  const [draggingReference, setDraggingReference] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const referencesRef = useRef<ReferenceImage[]>([]);
  const modelPanelRef = useRef<HTMLDivElement>(null);
  const parameterPanelRef = useRef<HTMLDivElement>(null);
  const generationCountPanelRef = useRef<HTMLFieldSetElement>(null);
  const generationCountInputRef = useRef<HTMLInputElement>(null);
  const videoDurationPanelRef = useRef<HTMLFieldSetElement>(null);
  const videoDurationInputRef = useRef<HTMLInputElement>(null);
  const provider = useProviderStore(getActiveProvider);
  const setModelSelection = useProviderStore((state) => state.setModelSelection);
  const setActiveModule = useUIStore((state) => state.setActiveModule);
  const generationMode = useUIStore((state) => state.generationMode);
  const imageModel = getSelectedModel(provider, 'image');
  const videoModel = getSelectedModel(provider, 'video');
  const selectedModel = generationMode === 'image' ? imageModel : videoModel;
  const modelOptions = useMemo(
    () => getConfiguredModels(provider)
      .filter((model) => modelSupportsCategory(model, generationMode))
      .map((model) => model.id),
    [generationMode, provider],
  );
  const ratioOptions = generationMode === 'video' ? VIDEO_RATIO_OPTIONS : RATIO_OPTIONS;
  const selectedVideoDuration = videoDuration === 'custom' ? customVideoDuration : videoDuration;
  const selectedGenerationCount = generationCount === 'custom' ? customGenerationCount : generationCount;
  const parameterSummary = generationMode === 'video'
    ? `${VIDEO_RATIO_OPTIONS.find((option) => option.value === ratio)?.label || ratio} · ${videoClarity}`
    : `${ratio} · ${quality} · ${resolution}`;

  referencesRef.current = referenceImages;
  useEffect(() => () => referencesRef.current.forEach((item) => URL.revokeObjectURL(item.url)), []);
  useEffect(() => {
    if (generationMode === 'video' && !VIDEO_RATIO_OPTIONS.some((option) => option.value === ratio)) {
      setRatio('16:9');
    }
  }, [generationMode, ratio]);
  useEffect(() => {
    if (!modelPanelOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!modelPanelRef.current?.contains(event.target as Node)) setModelPanelOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModelPanelOpen(false);
    };
    window.addEventListener('pointerdown', closeOnOutsidePress);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePress);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [modelPanelOpen]);
  useEffect(() => {
    if (!parameterPanelOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!parameterPanelRef.current?.contains(event.target as Node)) setParameterPanelOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setParameterPanelOpen(false);
    };
    window.addEventListener('pointerdown', closeOnOutsidePress);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePress);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [parameterPanelOpen]);
  useEffect(() => {
    if (!generationCountPanelOpen) return;
    window.requestAnimationFrame(() => {
      generationCountInputRef.current?.focus();
      generationCountInputRef.current?.select();
    });
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!generationCountPanelRef.current?.contains(event.target as Node)) setGenerationCountPanelOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGenerationCountPanelOpen(false);
    };
    window.addEventListener('pointerdown', closeOnOutsidePress);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePress);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [generationCountPanelOpen]);
  useEffect(() => {
    if (!videoDurationPanelOpen) return;
    window.requestAnimationFrame(() => {
      videoDurationInputRef.current?.focus();
      videoDurationInputRef.current?.select();
    });
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!videoDurationPanelRef.current?.contains(event.target as Node)) setVideoDurationPanelOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setVideoDurationPanelOpen(false);
    };
    window.addEventListener('pointerdown', closeOnOutsidePress);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePress);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [videoDurationPanelOpen]);
  useEffect(() => {
    let cancelled = false;
    historyLoadedRef.current = false;
    void workspaceCacheService.read<GenerationHistoryCache>('generation-history')
      .then((cached) => {
        if (cancelled) return;
        const migrated = feedHistory();
        const normalized: GenerationHistoryCache = {
          image: Array.isArray(cached?.image) && cached.image.length ? cached.image : migrated.image,
          video: Array.isArray(cached?.video) && cached.video.length ? cached.video : migrated.video,
        };
        historyCacheRef.current = normalized;
        setHistory(normalized[generationMode]);
        setPreviewUrl(normalized[generationMode][0]?.outputs[0] || '');
        historyLoadedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) historyLoadedRef.current = true;
      });
    return () => { cancelled = true; };
  }, [generationMode]);

  useEffect(() => {
    if (!historyLoadedRef.current) return;
    historyCacheRef.current[generationMode] = history;
    const timer = window.setTimeout(() => {
      void workspaceCacheService.write('generation-history', historyCacheRef.current).catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [generationMode, history]);

  const addReferences = (files: FileList | File[]) => {
    const accepted = [...files].filter(isImage).slice(0, 3 - referenceImages.length);
    if (!accepted.length) {
      setError('请添加图片格式的参考图（最多 3 张）。');
      return;
    }
    setError('');
    setReferenceImages((current) => [
      ...current,
      ...accepted.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  };

  const removeReference = (id: string) => {
    setReferenceImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((item) => item.id !== id);
    });
  };

  const insertReferenceMention = (index: number) => {
    const mention = `@图片${index + 1} `;
    const input = promptInputRef.current;
    if (!input) {
      setPrompt((current) => `${current}${current ? ' ' : ''}${mention}`);
      return;
    }
    const start = input.selectionStart ?? prompt.length;
    const end = input.selectionEnd ?? start;
    setPrompt(`${prompt.slice(0, start)}${mention}${prompt.slice(end)}`);
    window.requestAnimationFrame(() => {
      input.focus();
      const cursor = start + mention.length;
      input.setSelectionRange(cursor, cursor);
    });
  };

  const handleGenerate = async (promptOverride?: string) => {
    const generationPrompt = promptOverride ?? prompt;
    if (!provider?.apiKey || !selectedModel) {
      setError(`请先在设置中配置支持${generationMode === 'image' ? '图像' : '视频'}生成的 API Provider。`);
      setActiveModule('settings');
      return;
    }
    if (!generationPrompt.trim()) {
      setError(`请输入想生成的${generationMode === 'image' ? '画面' : '视频'}描述。`);
      return;
    }
    setError('');
    setIsGenerating(true);
    try {
      if (generationMode === 'video') {
        const result = await generateProviderVideo({ ...provider, model: videoModel }, { prompt: generationPrompt, resolution: videoResolutionForRatio(ratio) });
        setPreviewUrl(result.url);
        contentFeed.add({
          type: 'video',
          title: `视频生成任务 · ${new Date().toLocaleDateString('zh-CN')}`,
          description: generationPrompt,
          previewUrl: result.url,
          metadata: {
            prompt: generationPrompt,
            model: videoModel,
            ratio,
            resolution: videoClarity,
            quality: videoClarity,
            duration: selectedVideoDuration,
            referenceImageNames: referenceImages.map((item) => item.file.name),
            referenceVideoName: referenceVideo?.name,
            referenceAudioName: referenceAudio?.name,
            status: 'completed',
            taskId: result.id,
          },
        });
        setHistory((current) => [{
          id: `${Date.now()}-${result.url}`,
          prompt: generationPrompt,
          createdAt: new Date().toISOString(),
          model: videoModel,
          ratio,
          resolution: videoClarity,
          quality: videoClarity,
          duration: selectedVideoDuration,
          outputs: [result.url],
          mode: 'video' as const,
        }, ...current].slice(0, 12));
        setAssetNotice('视频生成完成，已加入视频素材');
        window.setTimeout(() => setAssetNotice(''), 3000);
        return;
      }
      const results = await Promise.all(Array.from({ length: selectedGenerationCount }, () => generateProviderImage({ ...provider, model: imageModel }, {
          prompt: generationPrompt,
          size: imageSizeForRatio(ratio, imageModel),
          quality: imageModel.toLowerCase().includes('dall-e-3')
            ? quality === '低' ? 'standard' : 'hd'
            : quality === '低' ? 'medium' : 'high',
        })));
      const outputs = results.map((result) => result.url);
      setPreviewUrl(outputs[0] || '');
      setHistory((current) => [{
        id: `${Date.now()}-${outputs[0]}`,
        prompt: generationPrompt,
        createdAt: new Date().toISOString(),
        model: imageModel,
        ratio,
        resolution,
        quality,
        outputs,
        mode: 'image' as const,
      }, ...current.filter((item) => !item.outputs.some((output) => outputs.includes(output)))].slice(0, 12));
      outputs.forEach((output, index) => contentFeed.add({
          type: 'image',
          title: `图片生成${outputs.length > 1 ? ` ${index + 1}/${outputs.length}` : ''} · ${new Date().toLocaleDateString('zh-CN')}`,
          description: generationPrompt,
          previewUrl: output,
          metadata: { prompt: generationPrompt, model: imageModel, ratio, resolution, quality, generationCount: selectedGenerationCount, referenceImageNames: referenceImages.map((item) => item.file.name) },
        }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '图像生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = (url: string) => {
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `design-work-image-${Date.now()}.jpg`;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.click();
  };

  const handleAddToAssets = async (urlOverride = previewUrl, promptOverride = prompt) => {
    if (!urlOverride) return;
    const existing = contentFeed.list().find((item) => item.previewUrl === urlOverride);
    if (existing?.savedToAssets) {
      setAssetNotice('该图片已在资产库中');
      return;
    }
    try {
      await assetService.create({
        type: 'image',
        title: `图片生成 · ${new Date().toLocaleDateString('zh-CN')}`,
        description: promptOverride,
        userMetadata: {
          source: 'image-generation',
          prompt: promptOverride,
          model: imageModel,
          ratio,
          resolution,
          quality,
          generatedUrl: urlOverride,
          referenceImageNames: referenceImages.map((item) => item.file.name),
        },
      });
      const generated = contentFeed.list().find((item) => item.previewUrl === urlOverride);
      if (generated) contentFeed.markSaved(generated.id);
      setAssetNotice('已添加到资产库');
      window.setTimeout(() => setAssetNotice(''), 2200);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '添加资产失败');
    }
  };

  const selectModel = (model: string) => {
    if (provider) setModelSelection(provider.id, generationMode, model);
    setModelPanelOpen(false);
  };

  const editRecordPrompt = (record: GenerationRecord) => {
    setPrompt(record.prompt);
    window.requestAnimationFrame(() => {
      const promptInput = document.getElementById('flow-image-prompt');
      promptInput?.focus();
      promptInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const selectRecord = (output: string, index: number) => {
    setPreviewUrl(output);
    document.getElementById(`generation-result-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="module-workspace mx-3 mb-3 mt-0 grid h-[calc(100%-12px)] min-h-0 grid-cols-[480px_minmax(0,1fr)] gap-0 !bg-transparent p-0 text-foreground">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-l-lg border border-r-0 border-[var(--surface-border)] bg-white p-4 dark:bg-[var(--surface-subtle)]" aria-label="生成输入与参数">
        <header className="mb-5 shrink-0">
          <h1 className="text-xl font-semibold tracking-tight">{generationMode === 'image' ? '图片生成' : '视频生成'}</h1>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          <div>
            <label className="mb-2 block text-xs font-semibold" htmlFor="flow-image-prompt">创作描述</label>
            <div
              onDragOver={(event) => { event.preventDefault(); setDraggingReference(true); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingReference(false); }}
              onDrop={(event) => { event.preventDefault(); setDraggingReference(false); addReferences(event.dataTransfer.files); }}
              className={cn('relative overflow-hidden rounded-lg bg-[var(--surface-control)] transition-colors focus-within:ring-1 focus-within:ring-ring', draggingReference && 'bg-[var(--surface-hover)] ring-2 ring-primary/20')}
            >
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { if (event.target.files) addReferences(event.target.files); event.target.value = ''; }} />
              <Textarea
                ref={promptInputRef}
                id="flow-image-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void handleGenerate(); }
                }}
                placeholder={generationMode === 'image' ? '描述主体、场景、光线、构图与风格…' : '描述视频主题、动作与镜头节奏…'}
                variant="ghost"
                className="min-h-[260px] resize-none rounded-none border-0 bg-transparent p-4 text-sm leading-6 shadow-none focus-visible:ring-0"
              />

              <div className="flex min-w-0 items-center gap-2 overflow-x-auto px-3 py-2">
                  {referenceImages.map((image, index) => (
                    <div key={image.id} className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-[var(--surface-border)]">
                      <Button type="button" variant="ghost" onClick={() => insertReferenceMention(index)} aria-label={`引用图片${index + 1}`} title={`在输入框中引用图片${index + 1}`} className="relative block h-full w-full rounded-none p-0">
                        <img src={image.url} alt={`参考图：${image.file.name}`} className="h-full w-full object-cover" />
                        <span className="absolute bottom-0 inset-x-0 bg-black/65 py-0.5 text-center text-[10px] font-medium text-white">图片{index + 1}</span>
                      </Button>
                      <Button type="button" variant="ghost" size="iconSm" onClick={() => removeReference(image.id)} aria-label={`移除参考图 ${image.file.name}`} className="absolute right-0.5 top-0.5 h-5 w-5 bg-black/70 p-0 text-white opacity-0 hover:bg-black group-hover:opacity-100 group-focus-within:opacity-100"><X size={10} /></Button>
                    </div>
                  ))}
                  {referenceImages.length < 3 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="添加参考图片"
                      className="h-14 w-14 shrink-0 justify-center rounded-md border border-dashed border-muted-foreground/40 bg-transparent p-0 text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground"
                    >
                      <span className="flex flex-col items-center gap-0.5"><Plus size={18} className="shrink-0" /><span className="text-[10px]">添加</span></span>
                    </Button>
                  )}
                </div>
              {draggingReference && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/75 text-sm font-medium backdrop-blur-sm">
                  松开即可添加参考图片
                </div>
              )}
            </div>
          </div>

          {generationMode === 'video' && (
            <div className="grid grid-cols-2 gap-3">
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(event) => {
                  setReferenceVideo(event.target.files?.[0] ?? null);
                  event.target.value = '';
                }}
              />
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="sr-only"
                onChange={(event) => {
                  setReferenceAudio(event.target.files?.[0] ?? null);
                  event.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => videoInputRef.current?.click()}
                aria-label={referenceVideo ? `替换参考视频：${referenceVideo.name}` : '上传参考视频'}
                title={referenceVideo?.name}
                className="h-20 min-w-0 flex-col justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-transparent px-3 text-muted-foreground shadow-none hover:bg-[var(--surface-hover)] hover:text-foreground"
              >
                <Video size={18} strokeWidth={1.5} />
                <span className="max-w-full truncate text-xs">{referenceVideo?.name || '参考视频'}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => audioInputRef.current?.click()}
                aria-label={referenceAudio ? `替换参考音频：${referenceAudio.name}` : '上传参考音频'}
                title={referenceAudio?.name}
                className="h-20 min-w-0 flex-col justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-transparent px-3 text-muted-foreground shadow-none hover:bg-[var(--surface-hover)] hover:text-foreground"
              >
                <AudioLines size={18} strokeWidth={1.5} />
                <span className="max-w-full truncate text-xs">{referenceAudio?.name || '参考音频'}</span>
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 items-end gap-3">
            <div ref={modelPanelRef} className="relative min-w-0">
              <label className="mb-2 block text-xs font-semibold">生成模型</label>
              <Button
                type="button"
                variant="ghost"
                disabled={!modelOptions.length}
                onClick={() => {
                  setParameterPanelOpen(false);
                  setGenerationCountPanelOpen(false);
                  setVideoDurationPanelOpen(false);
                  setModelPanelOpen((open) => !open);
                }}
                aria-haspopup="listbox"
                aria-expanded={modelPanelOpen}
                className="h-10 w-full justify-between rounded-lg border-0 bg-[var(--surface-control)] px-3 text-sm font-normal shadow-none hover:bg-[var(--surface-hover)]"
              >
                <span className="truncate">{selectedModel || `选择${generationMode === 'image' ? '图像' : '视频'}模型`}</span>
                <ChevronDown size={15} className={cn('shrink-0 text-muted-foreground transition-transform', modelPanelOpen && 'rotate-180')} />
              </Button>
              {modelPanelOpen && (
                <div role="listbox" aria-label={`${generationMode === 'image' ? '图像' : '视频'}生成模型`} className="absolute bottom-12 left-0 z-[90] max-h-[360px] w-full overflow-y-auto rounded-lg border border-[var(--surface-border-strong)] bg-popover p-1.5 text-popover-foreground shadow-xl">
                  {modelOptions.map((model) => {
                    const selected = selectedModel === model;
                    return (
                      <Button
                        key={model}
                        type="button"
                        variant="ghost"
                        role="option"
                        aria-selected={selected}
                        onClick={() => selectModel(model)}
                        className={cn(
                          'h-9 w-full min-w-0 justify-between rounded-md border-0 px-2.5 text-sm font-normal shadow-none',
                          selected ? 'bg-[var(--surface-hover)] text-foreground' : 'hover:bg-[var(--surface-control)]',
                        )}
                      >
                        <span className="truncate">{model}</span>
                        {selected && <Check size={14} className="shrink-0" />}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
            {generationMode === 'image' && (
              <fieldset ref={generationCountPanelRef} className="relative min-w-0">
                <legend className="mb-2 text-xs font-semibold">生成数量</legend>
                <div className="grid h-10 grid-cols-5 rounded-lg bg-[var(--surface-control)] p-1">
                  {GENERATION_COUNT_OPTIONS.map((option) => (
                    <Button key={option} type="button" variant="ghost" aria-pressed={generationCount === option} onClick={() => { setGenerationCount(option); setGenerationCountPanelOpen(false); }} className={cn('h-8 min-w-0 whitespace-nowrap px-0 text-xs', generationCount === option && 'bg-black/[0.07] text-foreground hover:bg-black/[0.07] dark:bg-white/[0.14] dark:hover:bg-white/[0.14]')}>
                      {option}张
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={generationCount === 'custom'}
                    aria-haspopup="dialog"
                    aria-expanded={generationCountPanelOpen}
                    onClick={() => {
                      setGenerationCount('custom');
                      setModelPanelOpen(false);
                      setParameterPanelOpen(false);
                      setGenerationCountPanelOpen((open) => !open);
                    }}
                    className={cn('h-8 min-w-0 whitespace-nowrap px-0 text-xs', generationCount === 'custom' && 'bg-black/[0.07] text-foreground hover:bg-black/[0.07] dark:bg-white/[0.14] dark:hover:bg-white/[0.14]')}
                  >
                    {generationCount === 'custom' ? `${customGenerationCount}张 +` : '自定义'}
                  </Button>
                </div>
                {generationCountPanelOpen && (
                  <div role="dialog" aria-label="自定义生成张数" className="absolute bottom-12 right-0 z-[90] w-[180px] rounded-lg border border-[var(--surface-border-strong)] bg-popover p-3 text-popover-foreground shadow-xl">
                    <label className="mb-2 block text-xs font-semibold" htmlFor="custom-generation-count">自定义数量</label>
                    <div className="relative">
                      <Input
                        ref={generationCountInputRef}
                        id="custom-generation-count"
                        type="number"
                        min={1}
                        max={10}
                        value={customGenerationCount}
                        onChange={(event) => setCustomGenerationCount(Math.min(10, Math.max(1, Number(event.target.value) || 1)))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') setGenerationCountPanelOpen(false);
                        }}
                        inputSize="sm"
                        aria-label="自定义生成张数"
                        className="border-0 bg-[var(--surface-control)] pr-8 shadow-none"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">张</span>
                    </div>
                  </div>
                )}
              </fieldset>
            )}
            {generationMode === 'video' && (
              <fieldset ref={videoDurationPanelRef} className="relative min-w-0">
                <legend className="mb-2 text-xs font-semibold">秒数</legend>
                <div className="grid h-10 grid-cols-4 rounded-lg bg-[var(--surface-control)] p-1">
                  {VIDEO_DURATION_OPTIONS.map((option) => (
                    <Button key={option} type="button" variant="ghost" aria-pressed={videoDuration === option} onClick={() => { setVideoDuration(option); setVideoDurationPanelOpen(false); }} className={segmentedOptionClass(videoDuration === option)}>
                      {option}s
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    aria-pressed={videoDuration === 'custom'}
                    aria-haspopup="dialog"
                    aria-expanded={videoDurationPanelOpen}
                    onClick={() => {
                      setVideoDuration('custom');
                      setModelPanelOpen(false);
                      setParameterPanelOpen(false);
                      setGenerationCountPanelOpen(false);
                      setVideoDurationPanelOpen((open) => !open);
                    }}
                    className={segmentedOptionClass(videoDuration === 'custom')}
                  >
                    {videoDuration === 'custom' ? `${customVideoDuration}s +` : '自定义'}
                  </Button>
                </div>
                {videoDurationPanelOpen && (
                  <div role="dialog" aria-label="自定义视频秒数" className="absolute bottom-12 right-0 z-[90] w-[180px] rounded-lg border border-[var(--surface-border-strong)] bg-popover p-3 text-popover-foreground shadow-xl">
                    <label className="mb-2 block text-xs font-semibold" htmlFor="custom-video-duration">自定义秒数</label>
                    <div className="relative">
                      <Input
                        ref={videoDurationInputRef}
                        id="custom-video-duration"
                        type="number"
                        min={1}
                        max={60}
                        value={customVideoDuration}
                        onChange={(event) => setCustomVideoDuration(Math.min(60, Math.max(1, Number(event.target.value) || 1)))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') setVideoDurationPanelOpen(false);
                        }}
                        inputSize="sm"
                        aria-label="自定义视频秒数"
                        className="border-0 bg-[var(--surface-control)] pr-8 shadow-none"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">s</span>
                    </div>
                  </div>
                )}
              </fieldset>
            )}
          </div>

          <div ref={parameterPanelRef} className="relative">
            <label className="mb-2 block text-xs font-semibold">参数设置</label>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setModelPanelOpen(false);
                setGenerationCountPanelOpen(false);
                setVideoDurationPanelOpen(false);
                setParameterPanelOpen((open) => !open);
              }}
              aria-haspopup="true"
              aria-expanded={parameterPanelOpen}
              className="h-10 w-full justify-between rounded-lg border-0 bg-[var(--surface-control)] px-3 text-sm font-normal shadow-none hover:bg-[var(--surface-hover)]"
            >
              <span className="truncate">{parameterSummary}</span>
              <ChevronDown size={15} className={cn('shrink-0 text-muted-foreground transition-transform', parameterPanelOpen && 'rotate-180')} />
            </Button>

            {parameterPanelOpen && (
              <div role="dialog" aria-label="参数设置" className="absolute bottom-12 left-0 z-[90] w-full rounded-lg border border-[var(--surface-border-strong)] bg-popover p-4 text-popover-foreground shadow-xl">
                <div className="space-y-4">
                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold">画面比例</legend>
                    <div className={cn('grid rounded-lg bg-[var(--surface-control)]', generationMode === 'video' ? 'grid-cols-3 gap-2 p-2' : 'grid-cols-6 gap-1 p-1.5')}>
                      {ratioOptions.map((option) => {
                        const selected = ratio === option.value;
                        return (
                          <Button
                            key={option.value}
                            type="button"
                            variant="ghost"
                            aria-pressed={selected}
                            onClick={() => setRatio(option.value)}
                            className={cn(
                              'w-full flex-col rounded-md border-0 px-1 text-xs shadow-none ring-0',
                              generationMode === 'video' ? 'h-20 gap-2 py-2' : 'h-14 gap-1 py-1',
                              'hover:bg-black/[0.04] dark:hover:bg-white/[0.08]',
                              selected && 'bg-black/[0.08] text-foreground shadow-sm hover:bg-black/[0.08] dark:bg-white/[0.14] dark:hover:bg-white/[0.14]',
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cn('shrink-0 rounded-[2px] border-[1.5px] border-current', selected ? 'text-foreground' : 'text-muted-foreground')}
                              style={{ width: Math.max(10, Math.round(option.width * 0.82)), height: Math.max(10, Math.round(option.height * 0.82)) }}
                            />
                            {'label' in option ? (
                              <span className="flex flex-col items-center leading-none">
                                <span>{option.label}</span>
                                {option.resolutionLabel && <span className="mt-1 text-[10px] font-normal text-muted-foreground">{option.resolutionLabel}</span>}
                              </span>
                            ) : <span>{option.value}</span>}
                          </Button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {generationMode === 'video' ? (
                    <fieldset>
                      <legend className="mb-2 text-xs font-semibold">清晰度</legend>
                      <div className="grid grid-cols-3 rounded-lg bg-[var(--surface-control)] p-1">
                        {VIDEO_CLARITY_OPTIONS.map((option) => (
                          <Button key={option} type="button" variant="ghost" aria-pressed={videoClarity === option} onClick={() => setVideoClarity(option)} className={segmentedOptionClass(videoClarity === option)}>
                            {option}
                          </Button>
                        ))}
                      </div>
                    </fieldset>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <fieldset>
                        <legend className="mb-2 text-xs font-semibold">质量</legend>
                        <div className="grid grid-cols-3 rounded-lg bg-[var(--surface-control)] p-1">
                          {QUALITY_OPTIONS.map((option) => (
                            <Button key={option} type="button" variant="ghost" aria-pressed={quality === option} onClick={() => setQuality(option)} className={segmentedOptionClass(quality === option)}>
                              {option}
                            </Button>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset>
                        <legend className="mb-2 text-xs font-semibold">分辨率</legend>
                        <div className="grid grid-cols-3 rounded-lg bg-[var(--surface-control)] p-1">
                          {RESOLUTION_OPTIONS.map((option) => (
                            <Button key={option} type="button" variant="ghost" aria-pressed={resolution === option} onClick={() => setResolution(option)} className={segmentedOptionClass(resolution === option)}>
                              {option}
                            </Button>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 pt-4">
          {error && <p role="alert" className="mb-3 text-xs text-red-600 dark:text-red-300">{error}</p>}
          {assetNotice && <p role="status" className="mb-3 text-xs font-medium text-foreground">{assetNotice}</p>}
          <Button type="button" variant="primary" onClick={() => void handleGenerate()} disabled={isGenerating || !prompt.trim()} className="h-11 w-full border-0 text-sm font-semibold shadow-none">
            {isGenerating ? <><Loader2 size={16} className="animate-spin" /> 正在生成</> : <><Sparkles size={16} /> 生成{generationMode === 'image' ? '图片' : '视频'}</>}
          </Button>
        </div>
      </section>

      <section className="flex min-h-0 overflow-hidden rounded-r-lg border border-[var(--surface-border)] bg-white dark:bg-[var(--surface-subtle)]" aria-label="生成结果列表">
        <div className="min-w-0 flex-1 overflow-y-auto scroll-smooth">
          {isGenerating && (
            <div className="flex min-h-40 items-center justify-center gap-3 pb-4 text-sm text-muted-foreground">
              <Loader2 size={18} className="animate-spin text-foreground" /> 正在生成新的{generationMode === 'image' ? '图片' : '视频'}…
            </div>
          )}

          {history.length > 0 ? history.map((record, index) => {
            const output = record.outputs[0] || '';
            const isVideoRecord = record.mode === 'video';
            return (
              <article id={`generation-result-${index}`} key={record.id} className="scroll-mt-0 pb-4 last:pb-0">
                <header className="px-4 pb-3 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold">{isVideoRecord ? '视频生成' : '图片生成'}</h2>
                        <span className="text-xs text-muted-foreground">{record.ratio} · {record.resolution}{isVideoRecord && record.duration ? ` · ${record.duration}s` : ` · ${record.quality}`}</span>
                        <time dateTime={record.createdAt} className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"><Clock3 size={12} /> {formatGenerationTime(record.createdAt)}</time>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" type="button" onClick={() => editRecordPrompt(record)} aria-label={`编辑提示词：${record.prompt}`}><Pencil size={13} /> 编辑</Button>
                    <Button variant="ghost" size="sm" type="button" onClick={() => { setPrompt(record.prompt); void handleGenerate(record.prompt); }}><RefreshCw size={13} /> 再次生成</Button>
                    <Button variant="ghost" size="sm" type="button" onClick={() => downloadImage(output)}><Download size={13} /> 下载</Button>
                    {!isVideoRecord && <Button variant="ghost" size="sm" type="button" onClick={() => void handleAddToAssets(output, record.prompt)}><BookmarkPlus size={13} /> 存入资产</Button>}
                  </div>

                  <div className="group/prompt relative">
                    <p tabIndex={0} title={record.prompt} className="truncate rounded-md bg-[var(--surface-control)] px-3 py-2 text-sm text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring">{record.prompt}</p>
                    <div role="tooltip" className="pointer-events-none absolute inset-x-0 top-full z-30 mt-1 hidden rounded-md border border-[var(--surface-border-strong)] bg-popover px-3 py-2 text-sm leading-6 text-popover-foreground shadow-lg group-hover/prompt:block group-focus-within/prompt:block">
                      {record.prompt}
                    </div>
                  </div>
                </header>

                <div className="mx-4 flex min-h-[360px] items-center justify-center overflow-hidden rounded-lg bg-[#0b0b0b]">
                  {isVideoRecord
                    ? <video src={output} controls preload="metadata" className="max-h-[680px] w-full object-contain" />
                    : <img src={output} alt={record.prompt} className="max-h-[680px] w-full object-contain" />}
                </div>

              </article>
            );
          }) : !isGenerating && (
            <div className="flex h-full min-h-80 flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Sparkles size={24} className="mb-3 opacity-40" />
              生成的图片或视频将在这里按时间排列
            </div>
          )}
        </div>

        <aside className="w-[84px] shrink-0 overflow-y-auto border-l border-[var(--surface-border)] bg-[#f4f4f2] p-2 dark:bg-[#0b0b0b]" aria-label="快速切换生成结果">
          <div className="space-y-2">
            {history.map((record, index) => {
              const output = record.outputs[0] || '';
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => selectRecord(output, index)}
                  aria-label={`切换到第 ${index + 1} 条生成结果`}
                  aria-current={previewUrl === output ? 'true' : undefined}
                  className={cn('block aspect-square w-full overflow-hidden rounded-md border-2 bg-[#111] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', previewUrl === output ? 'border-foreground' : 'border-transparent hover:border-[var(--surface-border-strong)]')}
                >
                  {record.mode === 'video'
                    ? <video src={output} preload="metadata" className="h-full w-full object-cover" />
                    : <img src={output} alt="" className="h-full w-full object-cover" />}
                </button>
              );
            })}
          </div>
        </aside>
      </section>

    </main>
  );
};
