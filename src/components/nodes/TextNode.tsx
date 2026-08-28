import { memo, useMemo } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { Loader2, Send, Type } from '@/lib/remixIconShim';
import { BaseNode } from './BaseNode';
import { type TextNodeData } from '../../types/node.types';
import { getConfiguredModels, getSelectedModel, providerSupportsCategory, useProviderStore } from '../../stores/useProviderStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { generateProviderText } from '../../services/providerService';
import { Button, Select, Textarea } from '../ui';

type CanvasTextNode = Node<TextNodeData>;

export const TextNode = memo(({ id, data, selected }: NodeProps<CanvasTextNode>) => {
  const updateNode = useCanvasStore((state) => state.updateNode);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const providers = useProviderStore((state) => state.providers);
  const activeProviderId = useProviderStore((state) => state.activeProviderIds.language);
  const options = useMemo(() => providers.flatMap((provider) => getConfiguredModels(provider, 'language')
    .map((model) => ({ provider, model: model.id }))), [providers]);
  const provider = providers.find((item) => item.id === data.providerId && providerSupportsCategory(item, 'language'))
    || providers.find((item) => item.id === activeProviderId && providerSupportsCategory(item, 'language'))
    || options[0]?.provider;
  const model = data.model || getSelectedModel(provider, 'language') || options[0]?.model || '';
  const active = options.find((option) => option.provider.id === provider?.id && option.model === model);

  const generate = async () => {
    const target = active?.provider || provider;
    if (!target || !model) return updateNode(id, { error: '请先在设置 → API 与模型中添加文本模型' });
    if (!data.prompt?.trim()) return;
    updateNode(id, { isGenerating: true, error: undefined, providerId: target.id, model });
    try {
      const result = await generateProviderText(target, data.prompt, model);
      updateNode(id, { content: result.content, isGenerating: false });
    } catch (error) {
      updateNode(id, { isGenerating: false, error: error instanceof Error ? error.message : '生成失败' });
    }
  };

  return (
    <BaseNode selected={selected} icon={Type} title="文本" width={420} showSourceHandle showTargetHandle onDelete={() => deleteNode(id)}>
      <div className="px-3 pb-3">
        <div className="w-full rounded-lg border border-border bg-background p-2 shadow-sm">
          {data.isGenerating ? <div className="flex h-28 items-center justify-center gap-2 text-muted-foreground"><Loader2 size={16} className="animate-spin" /> 正在生成文本…</div> : <Textarea aria-label="文本输入" value={data.prompt || data.content || ''} onChange={(event) => updateNode(id, { prompt: event.target.value, content: event.target.value })} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void generate(); } }} placeholder="输入文本，@ 引用画布素材…" variant="ghost" className="nodrag nowheel h-28 min-h-0 w-full resize-none px-1 text-xs leading-6" />}
          <div className="mt-2 flex items-center gap-2 border-t border-border/70 pt-2">
            <Select aria-label="选择文本模型" value={active ? active.provider.id + '::' + active.model : ''} onChange={(event) => { const [providerId, ...parts] = event.target.value.split('::'); updateNode(id, { providerId, model: parts.join('::') }); }} disabled={!options.length} selectSize="sm" className="min-w-0 flex-1 text-xs" options={options.length ? options.map((option) => ({ value: option.provider.id + '::' + option.model, label: option.model })) : [{ value: '', label: '暂无文本模型' }]} />
            <Button type="button" variant="primary" size="iconSm" onClick={() => void generate()} disabled={data.isGenerating || !(data.prompt || data.content)?.trim()} aria-label="生成文本">{data.isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}</Button>
          </div>
          <div className="mt-2 flex items-center justify-between px-1 text-[11px] font-medium text-muted-foreground"><span className="truncate">{active?.provider.name || provider?.name || '未配置 Provider'}</span><span className="truncate font-mono">{model || '未选择模型'}</span></div>
          {data.error && <p role="alert" className="mt-2 px-1 text-xs leading-4 text-red-600 dark:text-red-300">{data.error}</p>}
        </div>
      </div>
    </BaseNode>
  );
});

TextNode.displayName = 'TextNode';
