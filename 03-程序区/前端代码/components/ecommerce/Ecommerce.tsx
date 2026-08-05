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
import { Badge, Button, Card, Input, Label, Select, Switch, Textarea } from '../ui';

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

const EmptyState = ({ title, desc, icon: Icon }: { title: string; desc: string; icon: React.ElementType }) => (
  <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-8 text-center">
    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-md bg-primary/15 text-foreground">
      <Icon size={30} />
    </div>
    <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{desc}</p>
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
    <div className="module-workspace flex h-full w-full flex-col gap-3 p-3 text-foreground sm:flex-row">
      <aside
        className={cn(
          'ui-module-panel shrink-0 overflow-hidden transition-all duration-300',
          leftOpen ? 'max-h-[46vh] w-full sm:max-h-none sm:w-[380px]' : 'h-12 w-full sm:h-full sm:w-12',
        )}
      >
        {!leftOpen ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setLeftOpen(true)}
            className="h-full w-full items-start rounded-none pt-4 text-muted-foreground"
            title="展开面板"
          >
            <PanelLeftOpen size={20} />
          </Button>
        ) : (
          <div className="flex h-full flex-col">
            <div className="grid grid-cols-2 gap-1 p-3">
              {([
                ['upload', Layers, '素材输入'],
                ['config', Settings2, '参数配置'],
              ] as const).map(([id, Icon, label]) => (
                <Button
                  type="button"
                  variant="ghost"
                  key={String(id)}
                  onClick={() => setLeftTab(id as 'upload' | 'config')}
                  className={cn(
                    'text-xs',
                    leftTab === id
                      ? 'bg-foreground text-background hover:bg-foreground/90 hover:text-background'
                      : 'text-muted-foreground',
                  )}
                >
                  <Icon size={15} />
                  {label}
                </Button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {leftTab === 'upload' ? (
                <div className="space-y-4">
                  <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click(); }}
                    className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/25 px-4 py-6 text-center transition-colors hover:border-foreground/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Upload className="mb-3 text-foreground" size={26} />
                    <p className="text-sm font-semibold">上传商品素材</p>
                    <p className="mt-1 text-xs text-muted-foreground">最多 10 张，支持主图、细节、工艺、证书</p>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => processFiles(event.target.files)} />
                  </div>

                  {imagesBase64.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {imagesBase64.map((image, index) => (
                        <div key={`${image.slice(0, 24)}-${index}`} className="group relative aspect-square overflow-hidden rounded-md bg-muted">
                          <img src={image} alt={`素材 ${index + 1}`} className="h-full w-full object-cover" />
                          <div className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">#{index}</div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="iconSm"
                            onClick={() => setImagesBase64((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                            aria-label={`移除素材 ${index + 1}`}
                            className="absolute right-1.5 top-1.5 hidden h-6 w-6 bg-black/60 text-white hover:bg-black/80 hover:text-white group-hover:inline-flex group-focus-within:inline-flex"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Input label="产品名称" value={manualInfo.name} onChange={(event) => setManualInfo((prev) => ({ ...prev, name: event.target.value }))} placeholder="例如：草本修护膏" />
                  <Textarea label="核心卖点补充" value={manualInfo.description} onChange={(event) => setManualInfo((prev) => ({ ...prev, description: event.target.value }))} className="h-24" placeholder="补充产品功效、品牌调性、禁忌信息..." />

                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => logoInputRef.current?.click()} className="text-xs">
                      {manualInfo.logoBase64 ? '已上传 Logo' : '上传 Logo'}
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => modelInputRef.current?.click()} className="text-xs">
                      {manualInfo.modelRefImage ? '已上传模特' : '模特参考'}
                    </Button>
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={(event) => handleSingleImage(event, 'logoBase64')} />
                  <input ref={modelInputRef} type="file" accept="image/*" hidden onChange={(event) => handleSingleImage(event, 'modelRefImage')} />
                  <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"><Label htmlFor="model-consistency" className="text-xs">生成人物时保持模特样貌一致</Label><Switch id="model-consistency" checked={manualInfo.isModelConsistent || false} onCheckedChange={(checked) => setManualInfo((prev) => ({ ...prev, isModelConsistent: checked }))} /></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3"><Input label="文案模型" value={settings.textModel} onChange={(event) => setSettings((prev) => ({ ...prev, textModel: event.target.value }))} inputSize="sm" className="text-xs" /><Input label="图像模型" value={settings.imageModel} onChange={(event) => setSettings((prev) => ({ ...prev, imageModel: event.target.value }))} inputSize="sm" className="text-xs" /></div>

                  <OptionGrid title="视觉风格" options={VISUAL_STYLES} value={config.visualStyle} onChange={(value) => setConfig((prev) => ({ ...prev, visualStyle: value }))} />
                  <OptionGrid title="排版风格" options={TYPO_STYLES} value={config.typographyStyle} onChange={(value) => setConfig((prev) => ({ ...prev, typographyStyle: value }))} />
                  <SimpleGrid title="画面比例" options={ASPECT_RATIOS} value={config.aspectRatio} onChange={(value) => setConfig((prev) => ({ ...prev, aspectRatio: value }))} />

                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="主标题语言" value={config.mainLanguage} options={LANGUAGES.filter((item) => item.id !== 'none')} onChange={(value) => setConfig((prev) => ({ ...prev, mainLanguage: value }))} />
                    <SelectField label="副文案语言" value={config.subLanguage} options={LANGUAGES} onChange={(value) => setConfig((prev) => ({ ...prev, subLanguage: value }))} />
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs">详情页场景</Label>
                    <div className="space-y-2">
                      {DEFAULT_SCENARIOS.map((scenario) => {
                        const checked = config.selectedScenarios.some((item) => item.id === scenario.id);
                        return (
                          <Button key={scenario.id} type="button" variant="secondary" aria-pressed={checked} onClick={() => setConfig((prev) => ({
                                ...prev,
                                selectedScenarios: !checked
                                  ? [...prev.selectedScenarios, scenario]
                                  : prev.selectedScenarios.filter((item) => item.id !== scenario.id),
                              }))} className={cn('h-auto w-full justify-start whitespace-normal p-2 text-left text-xs', checked && 'border-transparent bg-muted')}>
                            <span className="min-w-0">
                              <strong className="block">{scenario.label}</strong>
                              <span className="text-muted-foreground">{scenario.desc}</span>
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-0 p-4">
              <Button
                type="button"
                variant="primary"
                onClick={startGeneration}
                disabled={!canGenerate}
                className="h-8 w-full text-sm font-semibold"
              >
                {status === 'analyzing' || status === 'generating' ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                {status === 'analyzing' ? '正在分析商品素材' : status === 'generating' ? '正在生成 KV 方案' : '生成视觉全案'}
              </Button>
            </div>
          </div>
        )}
      </aside>

      <section className="ui-module-panel flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="ui-module-toolbar h-10 shrink-0 border-0 px-3">
          <div className="flex h-full items-center gap-5">
            <WorkspaceTabButton icon={Layers} label="KV 视觉系统" active={workspaceTab === 'generation'} onClick={() => setWorkspaceTab('generation')} />
            <WorkspaceTabButton icon={ScanEye} label="识别报告" active={workspaceTab === 'analysis'} onClick={() => setWorkspaceTab('analysis')} />
            <WorkspaceTabButton icon={ImageIcon} label="详情页拼图" active={workspaceTab === 'detail'} onClick={() => setWorkspaceTab('detail')} />
          </div>
          <div className="flex items-center gap-2">
            {posters.length > 0 && workspaceTab === 'generation' && (
              <Button type="button" variant="secondary" size="sm" onClick={generateAllImages}>
                <Sparkles size={14} />
                生成全部图片
              </Button>
            )}
            <Button type="button" variant="danger" size="sm" onClick={reset}>
              <RefreshCcw size={14} />
              重置
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {workspaceTab === 'generation' && (
            posters.length === 0 ? (
              <EmptyState icon={Sparkles} title="等待生成 KV 视觉方案" desc="上传商品素材并配置 API Key 后，系统会先分析品牌基因，再生成一组可渲染的电商详情页 KV 海报。" />
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {posters.map((poster) => {
                  const loading = generatingIds.has(poster.id);
                  return (
                    <Card key={poster.id} padding="none" className="overflow-hidden">
                      <div className="flex items-center justify-between border-b px-4 py-3">
                        <div>
                          <h3 className="text-sm font-bold">{String(poster.id + 1).padStart(2, '0')} · {poster.title}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">参考图：{poster.referenceImageIndices?.join(', ') || '0'}</p>
                        </div>
                        <Button type="button" variant="primary" size="sm" onClick={() => generateImage(poster)} disabled={loading}>
                          {loading ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                          {poster.generatedImage ? '重绘' : '生成'}
                        </Button>
                      </div>

                      <div className="aspect-[4/3] bg-muted/55">
                        {poster.generatedImage ? (
                          <img src={poster.generatedImage} alt={poster.title} className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            {loading ? '图像生成中...' : '尚未生成图片'}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 p-4">
                        <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">{poster.chineseDescription}</p>
                        <details className="rounded-md bg-muted/55 p-3 text-xs">
                          <summary className="cursor-pointer font-semibold text-foreground">Prompt 与排版策略</summary>
                          <p className="mt-3 whitespace-pre-wrap leading-5 text-muted-foreground">{poster.layoutStrategy}</p>
                          <p className="mt-3 whitespace-pre-wrap leading-5 text-muted-foreground">{poster.englishPrompt}</p>
                        </details>
                        {poster.generatedImage && (
                          <Button type="button" variant="secondary" size="sm" onClick={() => downloadImage(poster.generatedImage!, poster.title)} className="w-full">
                            <Download size={14} />
                            下载单张
                          </Button>
                        )}
                      </div>
                    </Card>
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
                <Card className="overflow-y-auto p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold">素材库</h3>
                    <Button type="button" variant="link" size="sm" onClick={() => setDetailIds(generatedPosters.map((poster) => poster.id))} className="text-xs">全选</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {generatedPosters.map((poster) => {
                      const active = detailIds.includes(poster.id);
                      return (
                        <Button type="button" variant="secondary" key={poster.id} onClick={() => setDetailIds((prev) => active ? prev.filter((id) => id !== poster.id) : [...prev, poster.id])} aria-pressed={active} className={cn('h-auto overflow-hidden whitespace-normal rounded-md border-2 bg-muted p-0 text-left', active ? 'border-primary' : 'border-transparent')}>
                          <img src={poster.generatedImage} alt={poster.title} className="aspect-square w-full object-cover" />
                          <p className="truncate px-2 py-1 text-xs">{poster.title}</p>
                        </Button>
                      );
                    })}
                  </div>
                </Card>
                <Card padding="none" className="flex min-w-0 flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h3 className="text-sm font-bold">长图预览</h3>
                    <Button type="button" variant="primary" size="sm" onClick={exportDetailPage} disabled={!selectedDetailPosters.length || isExporting}>
                      {isExporting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                      导出长图
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-muted/45 p-6">
                    <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-md bg-background shadow-xl">
                      {selectedDetailPosters.length ? selectedDetailPosters.map((poster) => (
                        <img key={poster.id} src={poster.generatedImage} alt={poster.title} className="block w-full" />
                      )) : (
                        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">请选择要拼接的图片</div>
                      )}
                    </div>
                  </div>
                </Card>
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
  <Button
    type="button"
    variant="ghost"
    onClick={onClick}
    className={cn(
      'h-full rounded-none border-b-2 px-1 text-sm font-semibold',
      active
        ? 'border-primary text-foreground'
        : 'border-transparent text-muted-foreground',
    )}
  >
    <Icon size={16} />
    {label}
  </Button>
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
    <Label className="mb-2 block text-xs">{title}</Label>
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <Button
          type="button"
          variant="secondary"
          key={option.id}
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={cn(
            'h-auto justify-start whitespace-normal p-2 text-left',
            value === option.id
              ? 'border-transparent bg-muted'
              : '',
          )}
        >
          <span><span className="block text-xs font-semibold">{option.label}</span><span className="mt-1 line-clamp-2 block text-xs font-normal leading-4 text-muted-foreground">{option.desc}</span></span>
        </Button>
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
    <Label className="mb-2 block text-xs">{title}</Label>
    <div className="grid grid-cols-5 gap-2">
      {options.map((option) => (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          key={option}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            'px-2 text-xs',
            value === option
              ? 'border-transparent bg-muted'
              : '',
          )}
        >
          {option}
        </Button>
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
  <Select label={label} value={value} onChange={(event) => onChange(event.target.value)} selectSize="sm" className="text-xs" options={options.map((option) => ({ value: option.id, label: option.label }))} />
);

const ReportCard = ({ title, items }: { title: string; items: Array<string | undefined> }) => {
  const visibleItems = items.filter((item): item is string => Boolean(item?.trim()));

  return (
    <Card className="p-4">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      {visibleItems.length ? (
        <div className="flex flex-wrap gap-2">
          {visibleItems.map((item, index) => (
            <Badge key={`${item}-${index}`} variant="subtle" className="rounded-md px-2.5 py-1.5 text-xs font-normal leading-5">
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">暂无数据</p>
      )}
    </Card>
  );
};
