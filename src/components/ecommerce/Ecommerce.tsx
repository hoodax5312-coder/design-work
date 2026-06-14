import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  Download,
  FileText,
  Image as ImageIcon,
  Layers,
  Loader2,
  PanelLeftOpen,
  RefreshCcw,
  ScanEye,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  ASPECT_RATIOS,
  DEFAULT_SCENARIOS,
  LANGUAGES,
  TYPO_STYLES,
  VISUAL_STYLES,
} from '../../constants/kvmaster.constants';
import {
  analyzeProductImage,
  generateCampaignPrompts,
  generatePosterImage,
} from '../../services/geminiService';
import {
  type AdvancedSettings,
  type AnalysisReport,
  type EcommerceStatus,
  type EcommerceWorkspaceTab,
  type GenerationConfig,
  type ManualProductInfo,
  type ParsedPoster,
  TypographyStyle,
  VisualStyle,
} from '../../types/kvmaster.types';

const fileToDataUrl = (file: File) => (
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })
);

const parsePosterMarkdown = (markdown: string): ParsedPoster[] => {
  const posters: ParsedPoster[] = [];
  const sections = markdown.split(/(?=^#{2}\s)/gm);

  sections.forEach((section) => {
    const trimmed = section.trim();
    if (!trimmed.startsWith('## ')) return;

    const titleMatch = trimmed.match(/^#{2}\s+(.+)$/m);
    let title = titleMatch ? titleMatch[1].trim() : 'KV 海报';
    title = title.replace(/^(海报|Poster)\s*\d+\s*[:|\-]?\s*/i, '').replace(/^[\d\s._-]+/, '').trim();

    const chineseDescription = trimmed.match(/\*\*创意描述 \(Chinese\)\*\*[:\s]*([\s\S]*?)(?=\*\*参考图索引)/i)?.[1]?.trim() || '';
    const referenceText = trimmed.match(/\*\*参考图索引\*\*[:\s]*(\[?[\d,\s]+\]?)/i)?.[1] || '0';
    const referenceImageIndices = referenceText
      .replace(/[\[\]]/g, '')
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value));
    const layoutStrategy = trimmed.match(/\*\*排版策略 \(Chinese\)\*\*[:\s]*([\s\S]*?)(?=\*\*Prompt \(English\))/i)?.[1]?.trim() || '';
    const englishPrompt = (trimmed.match(/\*\*Prompt \(English\)\*\*[:\s]*([\s\S]*?)(?=\*\*Negative Prompts)/i)?.[1] || '')
      .replace(/```(text|markdown)?/gi, '')
      .replace(/```/g, '')
      .replace(/--[a-zA-Z]+\s+[\w.:]+/g, '')
      .replace(/\*\*/g, '')
      .trim();
    const negativePrompt = trimmed.match(/\*\*Negative Prompts\*\*[:\s]*([\s\S]*?)(?=$|---)/i)?.[1]?.trim() || '';

    if (englishPrompt.length > 5) {
      posters.push({
        id: posters.length,
        title,
        chineseDescription,
        englishPrompt,
        negativePrompt,
        layoutStrategy,
        referenceImageIndices: referenceImageIndices.length ? referenceImageIndices : [0],
      });
    }
  });

  return posters;
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-2">{children}</label>
);

const EmptyState = ({ title, desc, icon: Icon }: { title: string; desc: string; icon: React.ElementType }) => (
  <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center px-8">
    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5">
      <Icon size={30} />
    </div>
    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-zinc-400">{desc}</p>
  </div>
);

export const Ecommerce = () => {
  const [leftOpen, setLeftOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<'upload' | 'config'>('upload');
  const [workspaceTab, setWorkspaceTab] = useState<EcommerceWorkspaceTab>('generation');
  const [status, setStatus] = useState<EcommerceStatus>('idle');
  const [imagesBase64, setImagesBase64] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(null);
  const [posters, setPosters] = useState<ParsedPoster[]>([]);
  const [generatingIds, setGeneratingIds] = useState<Set<number>>(new Set());
  const [detailIds, setDetailIds] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const [manualInfo, setManualInfo] = useState<ManualProductInfo>({
    name: '',
    description: '',
    logoBase64: null,
    isModelConsistent: false,
    modelRefImage: null,
  });

  const [settings, setSettings] = useState<AdvancedSettings>({
    apiKey: '',
    textModel: 'gemini-3-pro-preview',
    imageModel: 'gemini-3-pro-image-preview',
    imageSize: '2K',
    baseUrl: 'https://generativelanguage.googleapis.com',
  });

  const [config, setConfig] = useState<GenerationConfig>({
    visualStyle: VisualStyle.AUTO,
    typographyStyle: TypographyStyle.AUTO,
    aspectRatio: '9:16',
    includeModel: false,
    includeScene: true,
    mainLanguage: 'Chinese',
    subLanguage: 'Chinese',
    selectedScenarios: DEFAULT_SCENARIOS.slice(0, 6),
  });

  const generatedPosters = useMemo(() => posters.filter((poster) => poster.generatedImage), [posters]);
  const selectedDetailPosters = detailIds
    .map((id) => posters.find((poster) => poster.id === id))
    .filter((poster): poster is ParsedPoster => Boolean(poster?.generatedImage));

  const processFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/')).slice(0, 10);
    const dataUrls = await Promise.all(imageFiles.map(fileToDataUrl));
    setImagesBase64((prev) => [...prev, ...dataUrls].slice(0, 10));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    processFiles(event.dataTransfer.files);
  };

  const handleSingleImage = async (
    event: ChangeEvent<HTMLInputElement>,
    key: 'logoBase64' | 'modelRefImage',
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setManualInfo((prev) => ({ ...prev, [key]: dataUrl }));
    event.target.value = '';
  };

  const startGeneration = async () => {
    if (!imagesBase64.length) {
      setLeftTab('upload');
      return;
    }

    if (!settings.apiKey.trim()) {
      setLeftTab('config');
      alert('请先配置 Gemini API Key。当前界面已隐藏 Key 输入，可在代码或后续全局设置中接入统一凭据。');
      return;
    }

    setStatus('analyzing');
    setWorkspaceTab('analysis');
    setAnalysis(null);
    setPosters([]);
    setDetailIds([]);

    try {
      const report = await analyzeProductImage(settings.apiKey, imagesBase64, settings, manualInfo);
      setAnalysis(report);
      setStatus('generating');
      setWorkspaceTab('generation');
      const markdown = await generateCampaignPrompts(settings.apiKey, report, config, settings, manualInfo);
      const parsed = parsePosterMarkdown(markdown);
      setPosters(parsed);
      setStatus('done');
    } catch (error) {
      console.error(error);
      setStatus('idle');
      alert('生成失败，请检查 API Key、模型名称或网络代理配置。');
    }
  };

  const generateImage = async (poster: ParsedPoster) => {
    setGeneratingIds((prev) => new Set(prev).add(poster.id));

    try {
      const indices = poster.referenceImageIndices?.length ? poster.referenceImageIndices : [0];
      const refs = indices.map((index) => imagesBase64[index]).filter(Boolean);
      const adjustedPrompt = poster.englishPrompt.replace(/\[Image\s*(\d+)\]/gi, (_, digit) => {
        const originalIndex = Number.parseInt(digit, 10);
        const position = indices.indexOf(originalIndex);
        return `[IMAGE ${position >= 0 ? position + 1 : 1}]`;
      });

      const image = await generatePosterImage(
        settings.apiKey,
        adjustedPrompt,
        settings,
        config.aspectRatio,
        refs.length ? refs : imagesBase64.slice(0, 1),
        manualInfo.logoBase64,
        manualInfo.isModelConsistent ? manualInfo.modelRefImage : null,
      );

      setPosters((prev) => prev.map((item) => item.id === poster.id ? { ...item, generatedImage: image } : item));
      setDetailIds((prev) => prev.includes(poster.id) ? prev : [...prev, poster.id]);
    } catch (error) {
      console.error(error);
      alert('单张海报生成失败，请稍后重试。');
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(poster.id);
        return next;
      });
    }
  };

  const generateAllImages = async () => {
    for (const poster of posters.filter((item) => !item.generatedImage)) {
      await generateImage(poster);
    }
  };

  const reset = () => {
    setImagesBase64([]);
    setAnalysis(null);
    setPosters([]);
    setDetailIds([]);
    setStatus('idle');
    setManualInfo({ name: '', description: '', logoBase64: null, isModelConsistent: false, modelRefImage: null });
  };

  const downloadImage = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name.replace(/[\\/:*?"<>|]/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDetailPage = async () => {
    if (!selectedDetailPosters.length) return;
    setIsExporting(true);

    try {
      const loadedImages = await Promise.all(selectedDetailPosters.map((poster) => (
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = poster.generatedImage!;
        })
      )));

      const width = loadedImages[0].width;
      const totalHeight = loadedImages.reduce((sum, image) => sum + image.height * (width / image.width), 0);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = width;
      canvas.height = totalHeight;
      let y = 0;
      loadedImages.forEach((image) => {
        const height = image.height * (width / image.width);
        ctx.drawImage(image, 0, y, width, height);
        y += height;
      });

      downloadImage(canvas.toDataURL('image/jpeg', 0.92), `ecommerce-detail-${Date.now()}`);
    } finally {
      setIsExporting(false);
    }
  };

  const canGenerate = imagesBase64.length > 0 && !['analyzing', 'generating'].includes(status);

  return (
    <div className="flex h-full w-full gap-2 bg-white dark:bg-black p-2 text-slate-900 dark:text-zinc-100">
      <aside
        className={cn(
          'shrink-0 overflow-hidden rounded-xl bg-white dark:bg-zinc-900 shadow-sm transition-all duration-300',
          leftOpen ? 'w-[380px]' : 'w-12',
        )}
      >
        {!leftOpen ? (
          <button
            onClick={() => setLeftOpen(true)}
            className="flex h-full w-full items-start justify-center pt-4 text-slate-400 hover:text-indigo-500"
            title="展开面板"
          >
            <PanelLeftOpen size={20} />
          </button>
        ) : (
          <div className="flex h-full flex-col">
            <div className="grid grid-cols-2 gap-1 p-3">
              {([
                ['upload', Layers, '素材输入'],
                ['config', Settings2, '参数配置'],
              ] as const).map(([id, Icon, label]) => (
                <button
                  key={String(id)}
                  onClick={() => setLeftTab(id as 'upload' | 'config')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                    leftTab === id
                      ? 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/10',
                  )}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {leftTab === 'upload' ? (
                <div className="space-y-4">
                  <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/10"
                  >
                    <Upload className="mb-3 text-indigo-500" size={26} />
                    <p className="text-sm font-semibold">上传商品素材</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">最多 10 张，支持主图、细节、工艺、证书</p>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => processFiles(event.target.files)} />
                  </div>

                  {imagesBase64.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {imagesBase64.map((image, index) => (
                        <div key={`${image.slice(0, 24)}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-zinc-800">
                          <img src={image} alt={`素材 ${index + 1}`} className="h-full w-full object-cover" />
                          <div className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">#{index}</div>
                          <button
                            onClick={() => setImagesBase64((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                            className="absolute right-1.5 top-1.5 hidden rounded bg-black/60 p-1 text-white group-hover:block"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <FieldLabel>产品名称</FieldLabel>
                    <input value={manualInfo.name} onChange={(event) => setManualInfo((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-950" placeholder="例如：草本修护膏" />
                  </div>
                  <div>
                    <FieldLabel>核心卖点补充</FieldLabel>
                    <textarea value={manualInfo.description} onChange={(event) => setManualInfo((prev) => ({ ...prev, description: event.target.value }))} className="h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-zinc-700 dark:bg-zinc-950" placeholder="补充产品功效、品牌调性、禁忌信息..." />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => logoInputRef.current?.click()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-white/10">
                      {manualInfo.logoBase64 ? '已上传 Logo' : '上传 Logo'}
                    </button>
                    <button onClick={() => modelInputRef.current?.click()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-white/10">
                      {manualInfo.modelRefImage ? '已上传模特' : '模特参考'}
                    </button>
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={(event) => handleSingleImage(event, 'logoBase64')} />
                  <input ref={modelInputRef} type="file" accept="image/*" hidden onChange={(event) => handleSingleImage(event, 'modelRefImage')} />
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                    <input type="checkbox" checked={manualInfo.isModelConsistent || false} onChange={(event) => setManualInfo((prev) => ({ ...prev, isModelConsistent: event.target.checked }))} />
                    生成人物时保持模特样貌一致
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>文案模型</FieldLabel>
                      <input value={settings.textModel} onChange={(event) => setSettings((prev) => ({ ...prev, textModel: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950" />
                    </div>
                    <div>
                      <FieldLabel>图像模型</FieldLabel>
                      <input value={settings.imageModel} onChange={(event) => setSettings((prev) => ({ ...prev, imageModel: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950" />
                    </div>
                  </div>

                  <OptionGrid title="视觉风格" options={VISUAL_STYLES} value={config.visualStyle} onChange={(value) => setConfig((prev) => ({ ...prev, visualStyle: value }))} />
                  <OptionGrid title="排版风格" options={TYPO_STYLES} value={config.typographyStyle} onChange={(value) => setConfig((prev) => ({ ...prev, typographyStyle: value }))} />
                  <SimpleGrid title="画面比例" options={ASPECT_RATIOS} value={config.aspectRatio} onChange={(value) => setConfig((prev) => ({ ...prev, aspectRatio: value }))} />

                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="主标题语言" value={config.mainLanguage} options={LANGUAGES.filter((item) => item.id !== 'none')} onChange={(value) => setConfig((prev) => ({ ...prev, mainLanguage: value }))} />
                    <SelectField label="副文案语言" value={config.subLanguage} options={LANGUAGES} onChange={(value) => setConfig((prev) => ({ ...prev, subLanguage: value }))} />
                  </div>

                  <div>
                    <FieldLabel>详情页场景</FieldLabel>
                    <div className="space-y-2">
                      {DEFAULT_SCENARIOS.map((scenario) => {
                        const checked = config.selectedScenarios.some((item) => item.id === scenario.id);
                        return (
                          <label key={scenario.id} className={cn('flex cursor-pointer gap-2 rounded-lg border p-2 text-xs transition-colors', checked ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-300' : 'border-slate-200 dark:border-zinc-700')}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => setConfig((prev) => ({
                                ...prev,
                                selectedScenarios: event.target.checked
                                  ? [...prev.selectedScenarios, scenario]
                                  : prev.selectedScenarios.filter((item) => item.id !== scenario.id),
                              }))}
                            />
                            <span>
                              <strong className="block">{scenario.label}</strong>
                              <span className="text-slate-500 dark:text-zinc-500">{scenario.desc}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 p-4 dark:border-zinc-800">
              <button
                onClick={startGeneration}
                disabled={!canGenerate}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-zinc-800"
              >
                {status === 'analyzing' || status === 'generating' ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                {status === 'analyzing' ? '正在分析商品素材' : status === 'generating' ? '正在生成 KV 方案' : '生成视觉全案'}
              </button>
            </div>
          </div>
        )}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm dark:bg-zinc-900">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-zinc-800">
          <div className="flex h-full items-center gap-5">
            <WorkspaceTabButton icon={Layers} label="KV 视觉系统" active={workspaceTab === 'generation'} onClick={() => setWorkspaceTab('generation')} />
            <WorkspaceTabButton icon={ScanEye} label="识别报告" active={workspaceTab === 'analysis'} onClick={() => setWorkspaceTab('analysis')} />
            <WorkspaceTabButton icon={ImageIcon} label="详情页拼图" active={workspaceTab === 'detail'} onClick={() => setWorkspaceTab('detail')} />
          </div>
          <div className="flex items-center gap-2">
            {posters.length > 0 && workspaceTab === 'generation' && (
              <button onClick={generateAllImages} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-white/10">
                <Sparkles size={14} />
                生成全部图片
              </button>
            )}
            <button onClick={reset} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30">
              <RefreshCcw size={14} />
              重置
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {workspaceTab === 'generation' && (
            posters.length === 0 ? (
              <EmptyState icon={Sparkles} title="等待生成 KV 视觉方案" desc="上传商品素材并配置 API Key 后，系统会先分析品牌基因，再生成一组可渲染的电商详情页 KV 海报。" />
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {posters.map((poster) => {
                  const loading = generatingIds.has(poster.id);
                  return (
                    <article key={poster.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
                        <div>
                          <h3 className="text-sm font-bold">{String(poster.id + 1).padStart(2, '0')} · {poster.title}</h3>
                          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">参考图：{poster.referenceImageIndices?.join(', ') || '0'}</p>
                        </div>
                        <button onClick={() => generateImage(poster)} disabled={loading} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-60">
                          {loading ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                          {poster.generatedImage ? '重绘' : '生成'}
                        </button>
                      </div>

                      <div className="aspect-[4/3] bg-slate-100 dark:bg-black">
                        {poster.generatedImage ? (
                          <img src={poster.generatedImage} alt={poster.title} className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-slate-400">
                            {loading ? '图像生成中...' : '尚未生成图片'}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 p-4">
                        <p className="line-clamp-3 text-xs leading-5 text-slate-600 dark:text-zinc-400">{poster.chineseDescription}</p>
                        <details className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-zinc-900">
                          <summary className="cursor-pointer font-semibold text-slate-700 dark:text-zinc-300">Prompt 与排版策略</summary>
                          <p className="mt-3 whitespace-pre-wrap leading-5 text-slate-500 dark:text-zinc-500">{poster.layoutStrategy}</p>
                          <p className="mt-3 whitespace-pre-wrap leading-5 text-slate-500 dark:text-zinc-500">{poster.englishPrompt}</p>
                        </details>
                        {poster.generatedImage && (
                          <button onClick={() => downloadImage(poster.generatedImage!, poster.title)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-white/10">
                            <Download size={14} />
                            下载单张
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          )}

          {workspaceTab === 'analysis' && (
            !analysis ? (
              <EmptyState icon={ScanEye} title={status === 'analyzing' ? '正在识别商品素材' : '还没有识别报告'} desc="识别报告会展示品牌、受众、卖点、色彩和每张图片的素材角色，方便检查 AI 是否理解正确。" />
            ) : (
              <div className="grid gap-4 xl:grid-cols-3">
                <ReportCard title="品牌识别" items={[analysis.brandName?.chinese, analysis.brandName?.english, analysis.productName, analysis.productType, analysis.productSpecs]} />
                <ReportCard title="目标受众" items={[analysis.targetAudience, analysis.targetAudienceAge, analysis.consumptionLevel, analysis.usageScenario]} />
                <ReportCard title="视觉系统" items={[analysis.designStyle, analysis.fontStyle, analysis.visualElements, analysis.brandTone]} />
                <ReportCard title="核心卖点" items={analysis.marketingCopy} />
                <ReportCard title="认证与数据" items={[...analysis.productCertifications, ...analysis.dataMetrics]} />
                <ReportCard title="素材索引" items={analysis.imageTags?.map((tag, index) => `#${index} ${tag}`)} />
                <ReportCard title="色彩" items={[...(analysis.colors?.primary || []), ...(analysis.colors?.secondary || []), analysis.colors?.styleDescription]} />
                <ReportCard title="包装与材质" items={[analysis.productMaterials, analysis.packagingMaterial, analysis.packagingStructure, analysis.packagingDesign, analysis.shelfLife]} />
              </div>
            )
          )}

          {workspaceTab === 'detail' && (
            generatedPosters.length === 0 ? (
              <EmptyState icon={FileText} title="等待可拼接素材" desc="先在 KV 视觉系统中生成图片，然后这里会把它们拼成一张电商详情页长图并导出。" />
            ) : (
              <div className="grid h-full min-h-[600px] grid-cols-[320px_1fr] gap-4">
                <div className="overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-zinc-800">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold">素材库</h3>
                    <button onClick={() => setDetailIds(generatedPosters.map((poster) => poster.id))} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">全选</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {generatedPosters.map((poster) => {
                      const active = detailIds.includes(poster.id);
                      return (
                        <button key={poster.id} onClick={() => setDetailIds((prev) => active ? prev.filter((id) => id !== poster.id) : [...prev, poster.id])} className={cn('overflow-hidden rounded-lg border-2 bg-slate-100 text-left dark:bg-zinc-950', active ? 'border-indigo-500' : 'border-transparent')}>
                          <img src={poster.generatedImage} alt={poster.title} className="aspect-square w-full object-cover" />
                          <p className="truncate px-2 py-1 text-[11px]">{poster.title}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col rounded-xl border border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
                    <h3 className="text-sm font-bold">长图预览</h3>
                    <button onClick={exportDetailPage} disabled={!selectedDetailPosters.length || isExporting} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
                      {isExporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                      导出长图
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-slate-100 p-6 dark:bg-black">
                    <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-lg bg-white shadow-xl">
                      {selectedDetailPosters.length ? selectedDetailPosters.map((poster) => (
                        <img key={poster.id} src={poster.generatedImage} alt={poster.title} className="block w-full" />
                      )) : (
                        <div className="flex h-64 items-center justify-center text-sm text-slate-400">请选择要拼接的图片</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
};

const WorkspaceTabButton = ({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'flex h-full items-center gap-2 border-b-2 px-1 text-sm font-semibold transition-colors',
      active
        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
        : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-200',
    )}
  >
    <Icon size={16} />
    {label}
  </button>
);

const OptionGrid = ({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { id: string; label: string; desc: string }[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <div>
    <FieldLabel>{title}</FieldLabel>
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'rounded-lg border p-2 text-left transition-colors',
            value === option.id
              ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-300'
              : 'border-slate-200 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-white/10',
          )}
        >
          <span className="block text-xs font-bold">{option.label}</span>
          <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-slate-500 dark:text-zinc-500">{option.desc}</span>
        </button>
      ))}
    </div>
  </div>
);

const SimpleGrid = ({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <div>
    <FieldLabel>{title}</FieldLabel>
    <div className="grid grid-cols-5 gap-2">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={cn(
            'rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
            value === option
              ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-300'
              : 'border-slate-200 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-white/10',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  </div>
);

const SelectField = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) => (
  <div>
    <FieldLabel>{label}</FieldLabel>
    <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-950">
      {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </div>
);

const ReportCard = ({ title, items }: { title: string; items: Array<string | undefined> }) => {
  const visibleItems = items.filter((item): item is string => Boolean(item?.trim()));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      {visibleItems.length ? (
        <div className="flex flex-wrap gap-2">
          {visibleItems.map((item, index) => (
            <span key={`${item}-${index}`} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs leading-5 text-slate-700 dark:bg-zinc-900 dark:text-zinc-300">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">暂无数据</p>
      )}
    </div>
  );
};
