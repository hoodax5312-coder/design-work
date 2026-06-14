import { useState } from 'react';
import {
  GenerationLayout,
  OptionSelector,
  RatioSelector,
  PromptInput,
  GenerateButton,
  ReferenceUpload,
  ModelSelector,
  PreviewPanel,
  HistoryThumbnail,
} from '../generation';
import { generateProviderImage } from '../../services/providerService';
import { getActiveProvider, useProviderStore } from '../../stores/useProviderStore';
import { useUIStore } from '../../stores/useUIStore';

const QUALITY_OPTIONS = ['1k', '2k', '4k'] as const;
const RATIO_OPTIONS = ['自适应', '1:1', '9:16', '16:9', '2:3', '3:2', '3:4', '21:9'];
const imageSizeForRatio = (ratio: string, model: string) => {
  const isDallE3 = model.toLowerCase().includes('dall-e-3');
  if (ratio === '9:16' || ratio === '2:3' || ratio === '3:4') {
    return isDallE3 ? '1024x1792' : '1024x1536';
  }
  if (ratio === '16:9' || ratio === '3:2' || ratio === '21:9') {
    return isDallE3 ? '1792x1024' : '1536x1024';
  }
  return '1024x1024';
};

export const ImageGeneration = () => {
  const [prompt, setPrompt] = useState('');
  const [quality, setQuality] = useState<(typeof QUALITY_OPTIONS)[number]>('1k');
  const [ratio, setRatio] = useState('自适应');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState('');
  const provider = useProviderStore(getActiveProvider);
  const openModal = useUIStore((state) => state.openModal);
  const modelOptions = provider
    ? [{ value: provider.model, label: `${provider.name} · ${provider.model}` }]
    : [{ value: '', label: '请先配置 Provider' }];

  const handleGenerate = async () => {
    if (!provider?.apiKey) {
      setError('请先在设置中配置 API Provider');
      openModal('settings');
      return;
    }
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError('');
    try {
      const result = await generateProviderImage(provider, {
        prompt,
        size: imageSizeForRatio(ratio, provider.model),
        quality: provider.model.toLowerCase().includes('dall-e-3')
          ? quality === '1k' ? 'standard' : 'hd'
          : quality === '1k' ? 'medium' : 'high',
      });
      setPreviewUrl(result.url);
      setHistory((current) => [result.url, ...current].slice(0, 6));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '图像生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefresh = () => void handleGenerate();

  const handleDownload = () => {
    const anchor = document.createElement('a');
    anchor.href = previewUrl;
    anchor.download = `mboard-image-${Date.now()}.jpg`;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.click();
  };

  const controlPanel = (
    <>
      <PromptInput
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="输入提示词..."
        height={160}
      />

      <ModelSelector
        value={provider?.model || ''}
        onChange={() => openModal('settings')}
        options={modelOptions}
      />

      <ReferenceUpload />

      <OptionSelector
        label="画质"
        options={[...QUALITY_OPTIONS]}
        value={quality}
        onChange={(v) => setQuality(v as typeof quality)}
        columns={3}
      />

      <RatioSelector
        value={ratio}
        onChange={setRatio}
        options={RATIO_OPTIONS}
        columns={4}
      />

      {error && <div className="text-sm leading-5 text-red-600">{error}</div>}
      <GenerateButton loading={isGenerating} onClick={() => void handleGenerate()} />
    </>
  );

  const previewPanel = (
    <PreviewPanel
      title="图片生成中..."
      previewContent={
        previewUrl ? (
          <img
            src={previewUrl}
            alt="Generated preview"
            className="max-w-full max-h-full object-contain shadow-lg"
          />
        ) : (
          <div className="text-sm text-slate-400">配置支持图像生成的 OpenAI 兼容 Provider 后开始创作</div>
        )
      }
      onRefresh={handleRefresh}
      onDownload={handleDownload}
      historyItems={
        <>
          {history.map((src) => (
            <HistoryThumbnail
              key={src}
              src={src}
              isActive={src === previewUrl}
              onClick={() => setPreviewUrl(src)}
            />
          ))}
        </>
      }
    />
  );

  return <GenerationLayout controlPanel={controlPanel} previewPanel={previewPanel} />;
};
