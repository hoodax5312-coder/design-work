import { memo, useMemo, useState } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { Image as ImageIcon, Loader2, Send, Sparkles } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { type ImageGenNodeData } from '../../types/node.types';
import { getConfiguredModels, getSelectedModel, modelSupportsCategory, useProviderStore } from '../../stores/useProviderStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { generateProviderImage } from '../../services/providerService';
import { cn } from '../../lib/utils';
import { Button, Card, Select, Textarea } from '../ui';

type ImageNode = Node<ImageGenNodeData>;
const ratios = ['1:1', '3:2', '4:3', '16:9', '9:16'] as const;
const sizeForRatio = (ratio: string) => ratio === '16:9' ? '1536x1024' : ratio === '9:16' ? '1024x1536' : '1024x1024';

export const ImageGenNode = memo(({ id, data, selected }: NodeProps<ImageNode>) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const updateNode = useCanvasStore((state) => state.updateNode);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const providers = useProviderStore((state) => state.providers);
  const activeProviderId = useProviderStore((state) => state.activeProviderId);
  const providerOptions = useMemo(() => providers.flatMap((provider) => getConfiguredModels(provider)
    .filter((model) => modelSupportsCategory(model, 'image'))
    .map((model) => ({ provider, model: model.id }))), [providers]);
  const selectedProvider = providers.find((provider) => provider.id === data.providerId)
    || providers.find((provider) => provider.id === activeProviderId)
    || providerOptions[0]?.provider;
  const model = data.model || getSelectedModel(selectedProvider, 'image') || providerOptions[0]?.model || '';
  const activeOption = providerOptions.find((option) => option.provider.id === selectedProvider?.id && option.model === model);
  const providerName = activeOption?.provider.name || selectedProvider?.name || '未配置 Provider';
  const generationMode = data.generationMode || 'text-to-image';
  const ratio = data.aspectRatio || '1:1';
  const quality = data.quality || 'standard';

  const selectModel = (value: string) => {
    const [providerId, ...modelParts] = value.split('::');
    updateNode(id, { providerId, model: modelParts.join('::') });
  };

  const generate = async () => {
    const provider = activeOption?.provider || selectedProvider;
    if (!provider || !model) {
      updateNode(id, { error: '请先在设置 → API 与模型中添加图像模型' });
      return;
    }
    if (!data.prompt?.trim()) return;
    updateNode(id, { isGenerating: true, error: undefined, providerId: provider.id, model });
    try {
      const result = await generateProviderImage({ ...provider, model }, { prompt: data.prompt, size: sizeForRatio(ratio), quality });
      updateNode(id, { imageUrl: result.url, isGenerating: false });
    } catch (error) {
      updateNode(id, { isGenerating: false, error: error instanceof Error ? error.message : '生成失败' });
    }
  };

  return (
    <BaseNode selected={selected} icon={ImageIcon} title={generationMode === 'image-to-image' ? '图生图' : '文生图'} width={420} showTargetHandle showSourceHandle onDelete={() => deleteNode(id)}>
      <div className="px-3 pb-3">
        <div className={cn('relative flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-md bg-muted/55', data.imageUrl ? '' : 'border border-dashed border-border')}>
          {data.imageUrl ? <img src={data.imageUrl} alt={data.prompt || '生成图片'} className="h-full min-h-[220px] w-full object-cover" /> : (
            <div className="max-w-[240px] text-center text-muted-foreground">
              {data.isGenerating ? <Loader2 size={25} className="mx-auto animate-spin" /> : <Sparkles size={24} className="mx-auto" />}
              <p className="mt-3 text-xs font-medium">{data.isGenerating ? '正在生成画面…' : generationMode === 'image-to-image' ? '连接参考图片并输入 Prompt 生成图片' : '在节点下方输入 Prompt 生成图片'}</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex w-full items-center gap-2 rounded-md border border-border bg-background p-2">
          <Textarea aria-label="图像生成提示词" value={data.prompt || ''} onChange={(event) => updateNode(id, { prompt: event.target.value })} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void generate(); } }} placeholder={generationMode === 'image-to-image' ? '描述如何基于参考图生成新画面…' : '描述想生成的画面，@ 引用画布素材…'} variant="ghost" className="nodrag nowheel h-14 min-h-0 flex-1 text-xs leading-5" />
          <Button type="button" variant="primary" size="iconSm" onClick={() => void generate()} disabled={data.isGenerating || !data.prompt?.trim()} aria-label="开始生成图片">{data.isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}</Button>
        </div>

        <div className="relative mt-2 flex w-full items-center gap-2">
          <Select aria-label="选择图像模型" value={activeOption ? activeOption.provider.id + '::' + activeOption.model : ''} onChange={(event) => selectModel(event.target.value)} disabled={!providerOptions.length} selectSize="sm" className="nodrag min-w-0 flex-1 text-xs" options={providerOptions.length ? providerOptions.map((option) => ({ value: option.provider.id + '::' + option.model, label: option.model })) : [{ value: '', label: '暂无图像模型' }]} />
          <Button type="button" variant="secondary" size="sm" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen} className="nodrag shrink-0 text-xs">{quality === 'hd' ? '高' : '标准'} · {ratio}</Button>
        </div>

        <div className="mt-2 flex w-full items-center justify-between text-xs font-medium text-muted-foreground">
          <span className="truncate">Provider · {providerName}</span>
          <span className="truncate font-mono">Model · {model || '未选择'}</span>
        </div>
        {settingsOpen && <Card padding="sm" className="nodrag mt-2 w-full"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">画面比例</p><div className="mt-2 grid grid-cols-5 gap-1">{ratios.map((item) => <Button key={item} type="button" variant={ratio === item ? 'primary' : 'ghost'} size="sm" onClick={() => updateNode(id, { aspectRatio: item })} className="h-8 px-1 text-xs">{item}</Button>)}</div><p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">质量</p><div className="mt-2 grid grid-cols-2 gap-1"><Button type="button" variant={quality === 'standard' ? 'primary' : 'ghost'} size="sm" onClick={() => updateNode(id, { quality: 'standard' })} className="h-8 text-xs">标准</Button><Button type="button" variant={quality === 'hd' ? 'primary' : 'ghost'} size="sm" onClick={() => updateNode(id, { quality: 'hd' })} className="h-8 text-xs">高</Button></div></Card>}
        {data.error && <p role="alert" className="mt-2 w-full text-xs leading-4 text-red-600 dark:text-red-300">{data.error}</p>}
      </div>
    </BaseNode>
  );
});

ImageGenNode.displayName = 'ImageGenNode';
