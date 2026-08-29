import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  BookmarkPlus,
  Check,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  Maximize2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Video,
  X,
} from '@/lib/remixIconShim';
import { generateProviderImage, generateProviderVideo } from '../../services/providerService';
import {
  getConfiguredModels,
  getSelectedModel,
  providerSupportsCategory,
  resolveModelConnection,
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
  'hover:bg-[var(--neutral-control-selected)] hover:text-[var(--neutral-foreground)]',
  selected && 'bg-[var(--neutral-control-selected)] text-[var(--neutral-foreground)] hover:bg-[var(--neutral-control-selected)]'
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

const formatGenerationDate = (value: string) => {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}.${part('month')}.${part('day')}`;
};

const formatGenerationParameters = (record: GenerationRecord) => (
  record.mode === 'video'
    ? [record.ratio, record.duration ? `${record.duration}秒` : null, record.resolution].filter(Boolean).join('·')
    : [record.ratio, record.quality, record.resolution].join('·')
);

const ActionIcon = ({ kind }: { kind: 'download' | 'save' | 'fullscreen' }) => {
  const Icon = kind === 'download' ? Download : kind === 'save' ? BookmarkPlus : Maximize2;
  // Remix icons share a 24px viewBox, but their paths have different optical bounds.
  const opticalScale = kind === 'save' ? 'scale-[1.15]' : kind === 'fullscreen' ? 'scale-[0.95]' : 'scale-[1.05]';
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center">
      <Icon size={20} className={opticalScale} aria-hidden="true" />
    </span>
  );
};

const ImageActionOverlay = ({
  onDownload,
  onSave,
  saved = false,
  onFullscreen,
}: {
  onDownload: () => void;
  onSave?: () => void;
  saved?: boolean;
  onFullscreen: () => void;
}) => (
  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-3/4 bg-gradient-to-t from-black/85 via-black/45 to-transparent" aria-hidden="true" />
    <div className="relative z-10 flex items-center gap-3">
      <Button type="button" variant="ghost" size="iconSm" onClick={onDownload} aria-label="下载图片" title="下载图片" className="h-10 w-10 bg-black/60 p-0 text-white shadow-lg hover:bg-black/85 hover:text-white"><ActionIcon kind="download" /></Button>
      {onSave && <>
        <Button type="button" variant="ghost" size="iconSm" onClick={onSave} disabled={saved} aria-label={saved ? '已存入资产' : '保存至资产'} title={saved ? '已存入资产' : '保存至资产'} className={cn('h-10 w-10 bg-black/60 p-0 text-white shadow-lg hover:bg-black/85 hover:text-white', saved && 'cursor-default bg-white/20 text-white/45 hover:bg-white/20 hover:text-white/45')}><ActionIcon kind="save" /></Button>
      </>}
      <Button type="button" variant="ghost" size="iconSm" onClick={onFullscreen} aria-label="全屏预览" title="全屏预览" className="h-10 w-10 bg-black/60 p-0 text-white shadow-lg hover:bg-black/85 hover:text-white"><ActionIcon kind="fullscreen" /></Button>
    </div>
  </div>
);

const SavedAssetBadge = ({ saved }: { saved?: boolean }) => saved ? (
  <span className="pointer-events-none absolute right-2 top-2 z-20 rounded-md bg-[var(--neutral-surface-subtle)] px-2 py-1 text-[11px] font-semibold leading-none text-[var(--neutral-foreground)] shadow-sm">
    已存入资产
  </span>
) : null;

const GeneratedImagePreview = ({
  src,
  alt,
  onDownload,
  onSave,
  saved,
  onFullscreen,
}: {
  src: string;
  alt: string;
  onDownload: () => void;
  onSave: () => void;
  saved?: boolean;
  onFullscreen: () => void;
}) => {
  const [imageRatio, setImageRatio] = useState<number | null>(null);

  return (
    <div
      className={cn(
        'group relative mx-2 flex max-h-[680px] min-h-[240px] items-center justify-center overflow-hidden rounded-lg bg-[#0b0b0b]',
      )}
      style={{ aspectRatio: imageRatio || 4 / 3 }}
    >
      <img
        src={src}
        alt={alt}
        onLoad={(event) => setImageRatio(Math.max(4 / 3, event.currentTarget.naturalWidth / event.currentTarget.naturalHeight))}
        className="h-auto max-h-full max-w-full object-contain"
      />
      <SavedAssetBadge saved={saved} />
      <ImageActionOverlay onDownload={onDownload} onSave={onSave} saved={saved} onFullscreen={onFullscreen} />
    </div>
  );
};

const GeneratedImageTile = ({ src, alt, onRatioChange }: { src: string; alt: string; onRatioChange: (ratio: number) => void }) => {

  return (
    <img
      src={src}
      alt={alt}
      onLoad={(event) => onRatioChange(Math.max(4 / 3, event.currentTarget.naturalWidth / event.currentTarget.naturalHeight))}
      className="block h-auto max-h-full max-w-full object-contain"
    />
  );
};

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
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const historyCacheRef = useRef<GenerationHistoryCache>({ image: [], video: [] });
  const historyLoadedRef = useRef(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [assetNotice, setAssetNotice] = useState('');
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [outputRatios, setOutputRatios] = useState<Record<string, number>>({});
  const [savedAssetUrls, setSavedAssetUrls] = useState<Set<string>>(
    () => new Set(contentFeed.list().filter((item) => item.savedToAssets).map((item) => item.previewUrl)),
  );
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
  const providers = useProviderStore((state) => state.providers);
  const activeProviderIds = useProviderStore((state) => state.activeProviderIds);
  const setSelectedModel = useProviderStore((state) => state.setSelectedModel);
  const setActiveModule = useUIStore((state) => state.setActiveModule);
  const generationMode = useUIStore((state) => state.generationMode);
  const imageProvider = providers.find((item) => item.id === activeProviderIds.image && providerSupportsCategory(item, 'image'));
  const videoProvider = providers.find((item) => item.id === activeProviderIds.video && providerSupportsCategory(item, 'video'));
  const provider = generationMode === 'image' ? imageProvider : videoProvider;
  const imageModel = getSelectedModel(imageProvider, 'image');
  const videoModel = getSelectedModel(videoProvider, 'video');
  const selectedModel = generationMode === 'image' ? imageModel : videoModel;
  const modelOptions = useMemo(
    () => getConfiguredModels(provider, generationMode).map((model) => model.id),
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
    const syncSavedAssets = () => setSavedAssetUrls(new Set(contentFeed.list().filter((item) => item.savedToAssets).map((item) => item.previewUrl)));
    syncSavedAssets();
    window.addEventListener('design-work:content-feed-updated', syncSavedAssets);
    return () => window.removeEventListener('design-work:content-feed-updated', syncSavedAssets);
  }, []);
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
    if (!provider || !resolveModelConnection(provider, generationMode, selectedModel)?.apiKey || !selectedModel) {
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
        const result = await generateProviderVideo(provider, { prompt: generationPrompt, resolution: videoResolutionForRatio(ratio) }, videoModel);
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
      const results = await Promise.all(Array.from({ length: selectedGenerationCount }, () => generateProviderImage(provider, {
          prompt: generationPrompt,
          size: imageSizeForRatio(ratio, imageModel),
          quality: imageModel.toLowerCase().includes('dall-e-3')
            ? quality === '低' ? 'standard' : 'hd'
            : quality === '低' ? 'medium' : 'high',
        }, imageModel)));
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
        sourceUrl: urlOverride,
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
      setSavedAssetUrls((current) => new Set(current).add(urlOverride));
      setAssetNotice('已添加到资产库');
      window.setTimeout(() => setAssetNotice(''), 2200);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '添加资产失败');
    }
  };

  const copyPrompt = async (record: GenerationRecord) => {
    try {
      await navigator.clipboard.writeText(record.prompt);
      setCopiedPromptId(record.id);
      window.setTimeout(() => setCopiedPromptId((current) => current === record.id ? null : current), 1800);
    } catch {
      setError('复制提示词失败，请检查浏览器剪贴板权限。');
    }
  };

  const deleteRecord = (record: GenerationRecord) => {
    if (!window.confirm('删除这条生成记录？')) return;
    setHistory((current) => current.filter((item) => item.id !== record.id));
    contentFeed.removeByPreviewUrls(record.outputs);
    if (record.outputs.includes(previewUrl)) {
      setPreviewUrl('');
    }
  };

  const selectModel = (model: string) => {
    if (provider) setSelectedModel(provider.id, generationMode, model);
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

  const fullscreenRecord = fullscreenImage
    ? history.find((record) => record.outputs.includes(fullscreenImage))
    : null;

  return (
    <main className="module-workspace mx-3 mb-3 mt-0 grid h-[calc(100%-12px)] min-h-0 grid-cols-[minmax(0,480px)_minmax(0,1fr)] gap-0 !bg-transparent p-0 text-foreground">
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-l-lg border border-border bg-card p-4 text-card-foreground" aria-label="生成输入与参数">
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
              className={cn('relative overflow-hidden rounded-lg border-solid [border-color:var(--generation-control-border)] [border-width:var(--generation-control-border-width)] bg-[var(--neutral-surface-subtle)] text-[var(--neutral-foreground)] transition-colors focus-within:ring-1 focus-within:ring-inset focus-within:ring-[var(--neutral-border)]', draggingReference && 'bg-[var(--neutral-surface)] text-[var(--neutral-foreground)] ring-2 ring-inset ring-[var(--neutral-border)]')}
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
                        <img src={image.url} alt={`参考图：${image.file.name}`} className="h-full w-full object-contain" />
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
                      className="h-14 w-14 shrink-0 justify-center rounded-md border border-dashed border-muted-foreground/40 bg-transparent p-0 text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]"
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
                className="h-20 min-w-0 flex-col justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-transparent px-3 text-muted-foreground shadow-none hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]"
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
                className="h-20 min-w-0 flex-col justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 bg-transparent px-3 text-muted-foreground shadow-none hover:bg-[var(--surface-hover)] hover:text-[var(--surface-hover-foreground)]"
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
                className="h-10 w-full justify-between rounded-lg border-solid [border-color:var(--generation-control-border)] [border-width:var(--generation-control-border-width)] bg-[var(--neutral-surface-subtle)] px-3 text-sm font-normal text-[var(--neutral-foreground)] shadow-none hover:bg-[var(--neutral-surface-hover)] hover:text-[var(--neutral-foreground)]"
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
                          selected ? 'bg-[var(--neutral-control-selected)] text-[var(--neutral-foreground)]' : 'hover:bg-[var(--neutral-surface-subtle)] hover:text-[var(--neutral-foreground)]',
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
                <div className="grid h-10 grid-cols-5 rounded-lg border-solid [border-color:var(--generation-control-border)] [border-width:var(--generation-control-border-width)] bg-[var(--neutral-surface-subtle)] p-1 text-[var(--neutral-foreground)]">
                  {GENERATION_COUNT_OPTIONS.map((option) => (
                    <Button key={option} type="button" variant="ghost" aria-pressed={generationCount === option} onClick={() => { setGenerationCount(option); setGenerationCountPanelOpen(false); }} className={cn('h-8 min-w-0 whitespace-nowrap px-0 text-xs', generationCount === option && 'bg-[var(--neutral-control-selected)] text-[var(--neutral-foreground)] hover:bg-[var(--neutral-control-selected)]')}>
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
                    className={cn('h-8 min-w-0 whitespace-nowrap px-0 text-xs', generationCount === 'custom' && 'bg-[var(--neutral-control-selected)] text-[var(--neutral-foreground)] hover:bg-[var(--neutral-control-selected)]')}
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
                        className="border-0 bg-[var(--neutral-surface)] pr-8 text-[var(--neutral-foreground)] shadow-none"
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
                <div className="grid h-10 grid-cols-4 rounded-lg bg-[var(--neutral-surface-subtle)] p-1 text-[var(--neutral-foreground)]">
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
                        className="border-0 bg-[var(--neutral-surface)] pr-8 text-[var(--neutral-foreground)] shadow-none"
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
              className="h-10 w-full justify-between rounded-lg border-solid [border-color:var(--generation-control-border)] [border-width:var(--generation-control-border-width)] bg-[var(--neutral-surface-subtle)] px-3 text-sm font-normal text-[var(--neutral-foreground)] shadow-none hover:bg-[var(--neutral-surface-hover)] hover:text-[var(--neutral-foreground)]"
            >
              <span className="truncate">{parameterSummary}</span>
              <ChevronDown size={15} className={cn('shrink-0 text-muted-foreground transition-transform', parameterPanelOpen && 'rotate-180')} />
            </Button>

            {parameterPanelOpen && (
              <div role="dialog" aria-label="参数设置" className="absolute bottom-12 left-0 z-[90] w-full rounded-lg border border-[var(--surface-border-strong)] bg-popover p-4 text-popover-foreground shadow-xl">
                <div className="space-y-4">
                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold">画面比例</legend>
                    <div className={cn('grid rounded-lg bg-[var(--neutral-surface-subtle)] text-[var(--neutral-foreground)]', generationMode === 'video' ? 'grid-cols-3 gap-2 p-2' : 'grid-cols-6 gap-1 p-1.5')}>
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
                              'hover:bg-[var(--neutral-control-selected)] hover:text-[var(--neutral-foreground)]',
                              selected && 'bg-[var(--neutral-control-selected)] text-[var(--neutral-foreground)] shadow-sm hover:bg-[var(--neutral-control-selected)]',
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
                      <div className="grid grid-cols-3 rounded-lg bg-[var(--neutral-surface-subtle)] p-1 text-[var(--neutral-foreground)]">
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
                        <div className="grid grid-cols-3 rounded-lg bg-[var(--neutral-surface-subtle)] p-1 text-[var(--neutral-foreground)]">
                          {QUALITY_OPTIONS.map((option) => (
                            <Button key={option} type="button" variant="ghost" aria-pressed={quality === option} onClick={() => setQuality(option)} className={segmentedOptionClass(quality === option)}>
                              {option}
                            </Button>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset>
                        <legend className="mb-2 text-xs font-semibold">分辨率</legend>
                        <div className="grid grid-cols-3 rounded-lg bg-[var(--neutral-surface-subtle)] p-1 text-[var(--neutral-foreground)]">
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
          <Button type="button" variant="primary" onClick={() => void handleGenerate()} disabled={isGenerating || !prompt.trim()} className="h-11 w-full border-0 bg-[var(--action-generate-bg)] text-[var(--action-generate-foreground)] text-sm font-semibold shadow-none hover:bg-[var(--action-generate-bg-hover)]">
            {isGenerating ? <><Loader2 size={16} className="animate-spin" /> 正在生成</> : <><Sparkles size={16} /> 生成{generationMode === 'image' ? '图片' : '视频'}</>}
          </Button>
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 overflow-hidden rounded-r-lg border !border-l-0 border-border bg-card pl-3 text-card-foreground" aria-label="生成结果列表">
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth">
          {isGenerating && (
            <div className="flex min-h-40 items-center justify-center gap-3 pb-4 text-sm text-muted-foreground">
              <Loader2 size={18} className="animate-spin text-foreground" /> 正在生成新的{generationMode === 'image' ? '图片' : '视频'}…
            </div>
          )}

          {history.length > 0 ? history.map((record, index) => {
            const output = record.outputs[0] || '';
            const selectedOutput = record.outputs.includes(previewUrl) ? previewUrl : output;
            const isVideoRecord = record.mode === 'video';
            return (
              <article id={`generation-result-${index}`} key={record.id} className="scroll-mt-0 pb-2 last:pb-0">
                <header className="bg-[var(--module-workspace-bg,var(--background))] px-2 pb-2 pt-2">
                  <div className="flex min-h-9 flex-wrap items-center gap-2">
                    <div className="min-w-[120px] flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="shrink-0 text-sm font-semibold">
                          {isVideoRecord ? '视频生成' : '图片生成'}-{formatGenerationDate(record.createdAt)}
                        </h2>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatGenerationParameters(record)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button variant="ghost" size="iconSm" type="button" onClick={() => editRecordPrompt(record)} aria-label={`编辑提示词：${record.prompt}`} title="编辑提示词" className="h-6 w-6 p-0"><Pencil size={13} /></Button>
                      <Button variant="ghost" size="iconSm" type="button" onClick={() => deleteRecord(record)} aria-label="删除生成记录" title="删除生成记录" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></Button>
                      {isVideoRecord && <Button variant="ghost" size="iconSm" type="button" onClick={() => downloadImage(selectedOutput)} aria-label="下载视频" title="下载视频" className="h-6 w-6 p-0"><Download size={13} /></Button>}
                    </div>
                  </div>

                  <div className="group/prompt relative">
                    <div className="flex min-w-0 items-center gap-2 rounded-md border-solid [border-color:var(--generation-control-border)] [border-width:var(--generation-control-border-width)] bg-[var(--neutral-surface-subtle)] px-3 py-2">
                      <p tabIndex={0} title={record.prompt} className="min-w-0 flex-1 truncate text-sm text-muted-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring">{record.prompt}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="iconSm"
                        onClick={() => void copyPrompt(record)}
                        aria-label="复制提示词"
                        title="复制提示词"
                        className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                      >
                        {copiedPromptId === record.id ? <Check size={14} /> : <Copy size={14} />}
                      </Button>
                    </div>
                    <div role="tooltip" className="pointer-events-none absolute inset-x-0 top-full z-30 mt-1 hidden rounded-md border border-[var(--surface-border-strong)] bg-popover px-3 py-2 text-sm leading-6 text-popover-foreground shadow-lg group-hover/prompt:block group-focus-within/prompt:block">
                      {record.prompt}
                    </div>
                  </div>
                </header>

                {isVideoRecord ? (
                  <div className="mx-2 flex min-h-[360px] items-end justify-center overflow-hidden rounded-lg bg-[#0b0b0b]">
                    <video src={output} controls preload="metadata" className="max-h-[680px] w-full object-contain" />
                  </div>
                ) : record.outputs.length > 1 ? (
                  <div className="mx-2 grid grid-cols-2 gap-2 rounded-lg bg-[var(--surface-control)] p-2">
                    {record.outputs.map((image, outputIndex) => (
                      <div
                        key={`${record.id}-${image}`}
                        className={cn(
                          'group relative flex min-w-0 items-center justify-center overflow-hidden rounded-md bg-[#0b0b0b] transition-shadow',
                          selectedOutput === image && 'ring-2 ring-inset ring-foreground'
                        )}
                        style={{ aspectRatio: outputRatios[image] || 4 / 3 }}
                      >
                        <button type="button" onClick={() => setPreviewUrl(image)} aria-label={`选择第 ${outputIndex + 1} 张生成图片`} aria-pressed={selectedOutput === image} className="block min-w-0 max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                          <GeneratedImageTile src={image} alt={`${record.prompt}，第 ${outputIndex + 1} 张`} onRatioChange={(nextRatio) => setOutputRatios((current) => current[image] === nextRatio ? current : { ...current, [image]: nextRatio })} />
                        </button>
                        <SavedAssetBadge saved={savedAssetUrls.has(image)} />
                        <ImageActionOverlay onDownload={() => downloadImage(image)} onSave={() => void handleAddToAssets(image, record.prompt)} saved={savedAssetUrls.has(image)} onFullscreen={() => setFullscreenImage(image)} />
                        <span className="absolute bottom-2 left-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{outputIndex + 1}/{record.outputs.length}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <GeneratedImagePreview src={output} alt={record.prompt} onDownload={() => downloadImage(output)} onSave={() => void handleAddToAssets(output, record.prompt)} saved={savedAssetUrls.has(output)} onFullscreen={() => setFullscreenImage(output)} />
                )}

              </article>
            );
          }) : !isGenerating && (
            <div className="flex h-full min-h-80 flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <Sparkles size={24} className="mb-3 opacity-40" />
              生成的图片或视频将在这里按时间排列
            </div>
          )}
        </div>

        <aside className="w-[84px] shrink-0 overflow-y-auto p-2" aria-label="快速切换生成结果">
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
                    ? <video src={output} preload="metadata" className="h-full w-full object-contain" />
                    : <img src={output} alt="" className="h-full w-full object-contain" />}
                </button>
              );
            })}
          </div>
        </aside>
      </section>

      {fullscreenImage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="全屏图片详情" onClick={() => setFullscreenImage(null)}>
          <aside className="flex h-screen w-screen flex-col overflow-hidden bg-black/25 text-white shadow-2xl backdrop-blur-xl" onClick={(event) => event.stopPropagation()}>
            <header className="flex h-12 w-full shrink-0 items-center justify-between px-4">
              <span className="min-w-0 truncate text-sm font-semibold" title={fullscreenRecord?.prompt || '图片详情'}>
                {fullscreenRecord ? `图片生成 · ${formatGenerationTime(fullscreenRecord.createdAt)}` : '图片详情'}
              </span>
              <div className="flex h-8 items-center gap-1 rounded-lg bg-white/10 text-white/85 backdrop-blur-xl">
                <Button type="button" variant="ghost" size="iconSm" onClick={() => downloadImage(fullscreenImage)} aria-label="下载图片" title="下载图片" className="h-8 w-8"><Download size={15} /></Button>
                <Button type="button" variant="ghost" size="iconSm" onClick={() => setFullscreenImage(null)} aria-label="关闭详情" title="关闭详情" className="h-8 w-8"><X size={16} /></Button>
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col items-stretch md:flex-row">
              <div className="relative flex min-h-[280px] min-w-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4">
                {fullscreenRecord?.mode === 'video' ? (
                  <video src={fullscreenImage} controls playsInline className="max-h-full max-w-full rounded-md object-contain" />
                ) : (
                  <img src={fullscreenImage} alt={fullscreenRecord?.prompt || '全屏预览'} className="block max-h-full max-w-full rounded-md object-contain" />
                )}
              </div>
              {fullscreenRecord && (
                <div className="flex min-h-0 w-full flex-col border-t border-white/10 bg-black/45 text-white backdrop-blur-xl md:mb-4 md:mr-2 md:max-w-[400px] md:rounded-xl md:border md:border-white/10 md:shadow-lg">
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                    <section className="max-h-[560px] space-y-3 rounded-lg bg-white/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-white/75">提示词</span>
                        <Button type="button" variant="ghost" size="iconSm" onClick={() => void navigator.clipboard?.writeText(fullscreenRecord.prompt)} aria-label="复制提示词" title="复制提示词" className="h-7 w-7 text-white/70 hover:bg-white/10 hover:text-white"><Copy size={13} /></Button>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-white">{fullscreenRecord.prompt || '暂无提示词'}</p>
                    </section>
                    <section className="space-y-3 rounded-lg bg-white/10 p-3">
                      <span className="text-xs font-medium text-white/75">模型参数</span>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-white/55">模型</dt><dd className="truncate font-medium text-white" title={fullscreenRecord.model}>{fullscreenRecord.model || '未记录'}</dd></div>
                        <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-white/55">比例</dt><dd className="truncate font-medium text-white">{fullscreenRecord.ratio}</dd></div>
                        <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-white/55">分辨率</dt><dd className="truncate font-medium text-white">{fullscreenRecord.resolution}</dd></div>
                        <div className="flex min-w-0 items-center gap-2"><dt className="shrink-0 text-white/55">质量</dt><dd className="truncate font-medium text-white">{fullscreenRecord.quality}</dd></div>
                      </dl>
                    </section>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

    </main>
  );
};
