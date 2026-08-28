import { useMemo } from 'react';
import { NodeToolbar, Position, type Node } from '@xyflow/react';
import { Loader2, Send } from '@/lib/remixIconShim';
import { generateProviderImage } from '../../services/providerService';
import { getConfiguredModels, getSelectedModel, providerSupportsCategory, useProviderStore } from '../../stores/useProviderStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { Button, Select, Textarea } from '../ui';

export const CanvasPromptOverlay = ({ node, selected }: { node: Node; selected: boolean }) => {
  const updateNode = useCanvasStore((state) => state.updateNode);
  const providers = useProviderStore((state) => state.providers);
  const activeProviderIds = useProviderStore((state) => state.activeProviderIds);
  const data = (node.data || {}) as Record<string, unknown>;
  const isImage = node.type === 'imageGen';
  const category = isImage ? 'image' : 'video';
  const options = useMemo(() => providers.flatMap((provider) => getConfiguredModels(provider, category)
    .map((model) => ({ provider, model: model.id }))), [category, providers]);
  const provider = providers.find((item) => item.id === data.providerId && providerSupportsCategory(item, category))
    || providers.find((item) => item.id === activeProviderIds[category] && providerSupportsCategory(item, category))
    || options[0]?.provider;
  const model = String(data.model || getSelectedModel(provider, category) || options[0]?.model || '');
  const active = options.find((option) => option.provider.id === provider?.id && option.model === model);
  const prompt = String(data.prompt || '');
  const ratio = String(data.aspectRatio || '1:1');
  const quality = String(data.quality || 'standard') as 'standard' | 'hd';
  const errorMessage = data.error ? String(data.error) : '';
  const isGenerating = Boolean(data.isGenerating);

  const generate = async () => {
    if (!prompt.trim() || !provider || !model) {
      updateNode(node.id, { error: `请先配置${isImage ? '图像' : '视频'}模型` });
      return;
    }
    if (!isImage) {
      updateNode(node.id, { providerId: provider.id, model, status: '任务已准备，可在视频工作台继续生成', error: undefined });
      return;
    }
    updateNode(node.id, { isGenerating: true, providerId: provider.id, model, error: undefined });
    try {
      const result = await generateProviderImage(provider, { prompt: String(prompt), size: ratio === '16:9' ? '1536x1024' : ratio === '9:16' ? '1024x1536' : '1024x1024', quality }, model);
      updateNode(node.id, { imageUrl: result.url, isGenerating: false });
    } catch (error) {
      updateNode(node.id, { isGenerating: false, error: error instanceof Error ? error.message : '生成失败' });
    }
  };

  return (
    <NodeToolbar isVisible={selected} position={Position.Bottom} offset={14} align="center" className="!z-[80] !p-0">
      <div className="nodrag nowheel w-[392px] max-w-[min(392px,calc(100vw-32px))] overflow-visible rounded-xl border border-border bg-card p-3 text-card-foreground shadow-[0_12px_32px_rgba(17,23,19,0.14)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.32)]" onPointerDown={(event) => event.stopPropagation()}>
        <div className="rounded-lg bg-muted px-1">
          <Textarea autoFocus={false} aria-label={`${isImage ? '图片' : '视频'}生成提示词`} value={prompt} onChange={(event) => updateNode(node.id, { prompt: event.target.value })} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void generate(); } }} placeholder={isImage ? '描述想生成的画面，@ 引用画布素材…' : '描述视频主题、动作与镜头节奏…'} variant="ghost" className="nowheel h-[88px] min-h-0 resize-none border-0 bg-transparent px-2 py-2 text-xs leading-5 shadow-none focus-visible:ring-0" />
          <div className="flex items-center gap-1 border-t border-border px-1 pb-1 pt-1">
            <Select aria-label={`选择${isImage ? '图像' : '视频'}模型`} value={active ? `${active.provider.id}::${active.model}` : ''} onChange={(event) => { const [providerId, ...parts] = event.target.value.split('::'); updateNode(node.id, { providerId, model: parts.join('::') }); }} disabled={!options.length} selectSize="sm" className="h-7 min-w-0 flex-1 border-0 bg-transparent text-[11px] shadow-none" options={options.length ? options.map((option) => ({ value: `${option.provider.id}::${option.model}`, label: option.model })) : [{ value: '', label: `暂无${isImage ? '图像' : '视频'}模型` }]} />
            <span className="flex h-7 shrink-0 items-center px-2 text-[11px] text-muted-foreground">{ratio}</span>
            <Button type="button" variant="primary" size="iconSm" onClick={() => void generate()} disabled={isGenerating || !prompt.trim()} aria-label={`生成${isImage ? '图片' : '视频'}`} className="h-7 w-7">{isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}</Button>
          </div>
        </div>
        {errorMessage && <p role="alert" className="mt-2 px-1 text-xs text-red-600 dark:text-red-300">{errorMessage}</p>}
      </div>
    </NodeToolbar>
  );
};
