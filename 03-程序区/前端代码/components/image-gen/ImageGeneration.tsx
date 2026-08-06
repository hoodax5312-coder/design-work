import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Clock3,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { generateProviderImage } from '../../services/providerService';
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
import { cn } from '../../lib/utils';
import { Badge, Button, Card, Select, Textarea } from '../ui';

const RESOLUTION_OPTIONS = ['1k', '2k', '4k'] as const;
const QUALITY_OPTIONS = ['低', '中', '高'] as const;
const RATIO_OPTIONS = ['16:9', '4:3', '1:1', '3:4', '9:16'];

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
  outputs: string[];
}

const isImage = (file: File) => file.type.startsWith('image/');

const imageSizeForRatio = (ratio: string, model: string) => {
  const isDallE3 = model.toLowerCase().includes('dall-e-3');
  if (ratio === '9:16' || ratio === '3:4') return isDallE3 ? '1024x1792' : '1024x1536';
  if (ratio === '16:9') return isDallE3 ? '1792x1024' : '1536x1024';
  return '1024x1024';
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
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState('');
  const [assetNotice, setAssetNotice] = useState('');
  const [draggingReference, setDraggingReference] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referencesRef = useRef<ReferenceImage[]>([]);
  const provider = useProviderStore(getActiveProvider);
  const setModelSelection = useProviderStore((state) => state.setModelSelection);
  const openModal = useUIStore((state) => state.openModal);
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

  referencesRef.current = referenceImages;
  useEffect(() => () => referencesRef.current.forEach((item) => URL.revokeObjectURL(item.url)), []);
  useEffect(() => {
    const closeSettings = (event: KeyboardEvent) => event.key === 'Escape' && setSettingsOpen(false);
    window.addEventListener('keydown', closeSettings);
    return () => window.removeEventListener('keydown', closeSettings);
  }, []);

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

  const handleGenerate = async (promptOverride?: string) => {
    const generationPrompt = promptOverride ?? prompt;
    if (!provider?.apiKey || !selectedModel) {
      setError(`请先在设置中配置支持${generationMode === 'image' ? '图像' : '视频'}生成的 API Provider。`);
      openModal('settings');
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
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        contentFeed.add({
          type: 'video',
          title: `视频生成任务 · ${new Date().toLocaleDateString('zh-CN')}`,
          description: generationPrompt,
          previewUrl: '',
          metadata: {
            prompt: generationPrompt,
            model: videoModel,
            ratio,
            resolution,
            quality,
            referenceImageNames: referenceImages.map((item) => item.file.name),
            status: 'queued',
          },
        });
        setAssetNotice('视频任务已创建，可在「视频 > 素材」查看');
        window.setTimeout(() => setAssetNotice(''), 3000);
        return;
      }
      const result = await generateProviderImage({ ...provider, model: imageModel }, {
        prompt: generationPrompt,
        size: imageSizeForRatio(ratio, imageModel),
        quality: imageModel.toLowerCase().includes('dall-e-3')
          ? quality === '低'
            ? 'standard'
            : 'hd'
          : quality === '低'
            ? 'medium'
            : 'high',
      });
      setPreviewUrl(result.url);
      setHistory((current) => [{
        id: `${Date.now()}-${result.url}`,
        prompt: generationPrompt,
        createdAt: new Date().toISOString(),
        model: imageModel,
        ratio,
        resolution,
        quality,
        outputs: [result.url],
      }, ...current.filter((item) => !item.outputs.includes(result.url))].slice(0, 12));
      contentFeed.add({
        type: 'image',
        title: `图片生成 · ${new Date().toLocaleDateString('zh-CN')}`,
        description: generationPrompt,
        previewUrl: result.url,
        metadata: {
          prompt: generationPrompt,
          model: imageModel,
          ratio,
          resolution,
          quality,
          referenceImageNames: referenceImages.map((item) => item.file.name),
        },
      });
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
  };

  const settingsSummary = `${ratio} · ${resolution} · ${quality}`;

  return (
    <main className="module-workspace relative h-full min-h-0 overflow-hidden text-foreground">
      <section className="absolute inset-0 overflow-y-auto pb-44">
        {history.length > 0 ? (
          <div className="creation-record-list mx-auto w-full max-w-[1720px] px-5 pb-12 pt-24 sm:px-8 lg:px-12">
            <div className="mb-8 flex items-end justify-between pb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Generation log</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">生成记录</h1>
              </div>
              <p className="hidden text-xs font-medium text-muted-foreground sm:block">按生成时间从新到旧排列</p>
            </div>

            <div className="space-y-0">
              {history.map((record) => (
                <article key={record.id} className="creation-record-row py-6 first:pt-0">
                  <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <time dateTime={record.createdAt} className="creation-record-time flex items-center gap-1.5 text-muted-foreground"><Clock3 size={13} /> {formatGenerationTime(record.createdAt)}</time>
                    <Badge variant="subtle">{record.model || '未命名模型'}</Badge>
                    <span className="text-muted-foreground">{record.ratio} · {record.resolution} · {record.quality}</span>
                  </header>

                  <div className="grid gap-4 lg:grid-cols-[minmax(230px,0.64fr)_minmax(0,1.7fr)]">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setPrompt(record.prompt); setPreviewUrl(record.outputs[0] || ''); }}
                      className="creation-record-prompt h-auto justify-start whitespace-normal text-left"
                    >
                      <span className="line-clamp-6">{record.prompt}</span>
                    </Button>
                    <div className="flex min-w-0 gap-3 overflow-x-auto pb-1">
                      {record.outputs.map((output, outputIndex) => (
                        <div key={output} className="group relative aspect-[4/5] min-h-[190px] min-w-[150px] flex-1 overflow-hidden rounded-lg border border-border bg-card sm:min-w-[210px]">
                          <Button type="button" variant="ghost" onClick={() => setPreviewUrl(output)} className="block h-full w-full rounded-none p-0" aria-label={`查看第 ${outputIndex + 1} 张生成图片`}><img src={output} alt={`生成结果 ${outputIndex + 1}：${record.prompt}`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" /></Button>
                          {previewUrl === output && <Badge className="absolute left-2 top-2 text-xs">当前</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" type="button" onClick={() => { setPrompt(record.prompt); void handleGenerate(record.prompt); }}><RefreshCw size={13} /> 再次生成</Button>
                    <Button variant="ghost" size="sm" type="button" onClick={() => downloadImage(record.outputs[0] || '')}><Download size={13} /> 下载</Button>
                    <Button variant="ghost" size="sm" type="button" onClick={() => { setPrompt(record.prompt); setPreviewUrl(record.outputs[0] || ''); void handleAddToAssets(record.outputs[0] || '', record.prompt); }}><BookmarkPlus size={13} /> 存入资产</Button>
                  </div>
                </article>
              ))}
              {isGenerating && <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground"><Loader2 size={17} className="animate-spin text-foreground" /> 正在生成新的画面…</div>}
            </div>
          </div>
        ) : isGenerating ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-4 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-muted"><Loader2 size={22} className="animate-spin text-foreground" /></span>
            <div><div className="text-sm font-semibold">{generationMode === 'image' ? '正在生成画面' : '正在创建视频任务'}</div><p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">{generationMode === 'image' ? '任务会直接显示在这块画布上' : '任务创建后会进入视频素材库'}</p></div>
          </div>
        ) : (
          <div className="flex min-h-full flex-col items-center justify-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-muted text-muted-foreground"><Sparkles size={23} strokeWidth={1.5} /></span>
            <p className="mt-4 text-sm text-slate-500 dark:text-zinc-500">{generationMode === 'image' ? '开始创作或拖放媒体' : '描述你想生成的视频片段'}</p>
          </div>
        )}
      </section>

      <div className="absolute bottom-5 left-1/2 z-20 w-[min(1040px,calc(100%-32px))] -translate-x-1/2">
        <div
          onDragOver={(event) => { event.preventDefault(); setDraggingReference(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingReference(false); }}
          onDrop={(event) => { event.preventDefault(); setDraggingReference(false); addReferences(event.dataTransfer.files); }}
            className={cn('rounded-lg bg-[#f8f8f6] p-2 shadow-sm transition-colors dark:bg-white/[0.05]', draggingReference ? 'ring-2 ring-primary/20' : '')}
        >
          <label className="sr-only" htmlFor="flow-image-prompt">{generationMode === 'image' ? '描述想生成的画面' : '描述想生成的视频'}</label>
          {referenceImages.length > 0 && <div className="mb-2 flex gap-2 overflow-x-auto px-1">{referenceImages.map((image) => <div key={image.id} className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-md border"><img src={image.url} alt={`参考图：${image.file.name}`} className="h-full w-full object-cover" /><Button type="button" variant="ghost" size="iconSm" onClick={() => removeReference(image.id)} aria-label={`移除参考图 ${image.file.name}`} className="absolute right-0.5 top-0.5 h-5 w-5 bg-background/85 p-0 text-foreground opacity-0 shadow-sm hover:bg-background group-hover:opacity-100 group-focus-within:opacity-100"><X size={10} /></Button></div>)}</div>}
          <Textarea
            id="flow-image-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void handleGenerate(); }
            }}
            placeholder={draggingReference ? '松开即可添加参考图' : generationMode === 'image' ? '你希望创作什么内容？' : '描述视频主题、动作与镜头节奏…'}
            variant="ghost" className="block h-[58px] min-h-0 text-sm leading-6"
          />
          <div className="flex items-center gap-2 pt-2">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { if (event.target.files) addReferences(event.target.files); event.target.value = ''; }} />
            <Button type="button" variant="ghost" size="iconSm" onClick={() => fileInputRef.current?.click()} aria-label="添加图片" title="添加图片（可选）" className="h-8 w-8 bg-transparent text-foreground hover:bg-white hover:text-black"><Plus size={18} /></Button>
            <div className="relative ml-auto w-auto min-w-0">
              <label className="sr-only" htmlFor="flow-generation-model">{generationMode === 'image' ? '图像模型' : '视频模型'}</label>
              <Select
                id="flow-generation-model"
                value={selectedModel}
                onChange={(event) => selectModel(event.target.value)}
                disabled={!modelOptions.length}
                selectSize="sm" className="h-8 w-auto max-w-[220px] truncate border-0 bg-transparent text-xs font-semibold shadow-none hover:bg-black/[0.05] focus-visible:ring-1 focus-visible:ring-black/10 dark:bg-transparent dark:hover:bg-white/[0.08] dark:focus-visible:ring-white/15"
                options={modelOptions.length ? [
                  ...(!selectedModel ? [{ value: '', label: `选择${generationMode === 'image' ? '图像' : '视频'}模型` }] : []),
                  ...modelOptions.map((model) => ({ value: model, label: model })),
                ] : [{ value: '', label: `暂无${generationMode === 'image' ? '图像' : '视频'}模型` }]}
              />
            </div>
            <div className="relative">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen} aria-controls="flow-image-settings" className="h-8 w-auto max-w-[260px] bg-transparent text-xs shadow-none hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.08]"><Sparkles size={13} /> <span className="truncate">{settingsSummary}</span></Button>
              {settingsOpen && <Card id="flow-image-settings" aria-label={`${generationMode === 'image' ? '图片' : '视频'}生成参数`} padding="sm" className="absolute bottom-12 right-0 w-[min(360px,calc(100vw-32px))] shadow-lg">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{generationMode === 'image' ? '图片比例' : '画面比例'}</div>
                <div className="mt-2 grid grid-cols-5 gap-1.5">{RATIO_OPTIONS.map((option) => <Button key={option} type="button" variant={ratio === option ? 'primary' : 'ghost'} size="sm" onClick={() => setRatio(option)} className="px-1 text-xs">{option}</Button>)}</div>
                <div className="mt-4 grid grid-cols-2 gap-3"><fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">分辨率</legend><div className="grid grid-cols-3 rounded-md bg-muted p-1">{RESOLUTION_OPTIONS.map((option) => <Button key={option} type="button" variant={resolution === option ? 'secondary' : 'ghost'} size="sm" onClick={() => setResolution(option)} className="px-1 text-xs">{option}</Button>)}</div></fieldset><fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">质量</legend><div className="grid grid-cols-3 rounded-md bg-muted p-1">{QUALITY_OPTIONS.map((option) => <Button key={option} type="button" variant={quality === option ? 'secondary' : 'ghost'} size="sm" onClick={() => setQuality(option)} className="px-1 text-xs">{option}</Button>)}</div></fieldset></div>
              </Card>}
            </div>
            <Button type="button" variant="ghost" size="iconSm" onClick={() => void handleGenerate()} disabled={isGenerating || !prompt.trim()} aria-label={isGenerating ? `正在生成${generationMode === 'image' ? '图片' : '视频'}` : `生成${generationMode === 'image' ? '图片' : '视频'}`} className="h-8 w-8 bg-black text-white hover:bg-black/85 hover:text-white"><Loader2 size={16} className={cn(isGenerating && 'animate-spin')} /><span className="sr-only">生成</span></Button>
          </div>
        </div>
        {error && <p role="alert" className="mt-2 text-center text-xs text-red-600 dark:text-red-300">{error}</p>}
      </div>

      {assetNotice && <div role="status" className="absolute bottom-5 right-5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background shadow-lg">{assetNotice}</div>}
    </main>
  );
};
