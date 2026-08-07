import { memo, useMemo } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { Film, Send, Video } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { type VideoNodeData } from '../../types/node.types';
import { getConfiguredModels, getSelectedModel, modelSupportsCategory, useProviderStore } from '../../stores/useProviderStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { Button, Select, Textarea } from '../ui';

type CanvasVideoNode = Node<VideoNodeData>;

export const VideoNode = memo(({ id, data, selected }: NodeProps<CanvasVideoNode>) => {
  const updateNode = useCanvasStore((state) => state.updateNode);
  const deleteNode = useCanvasStore((state) => state.deleteNode);
  const providers = useProviderStore((state) => state.providers);
  const activeProviderId = useProviderStore((state) => state.activeProviderId);
  const options = useMemo(() => providers.flatMap((provider) => getConfiguredModels(provider)
    .filter((model) => modelSupportsCategory(model, 'video'))
    .map((model) => ({ provider, model: model.id }))), [providers]);
  const provider = providers.find((item) => item.id === data.providerId) || providers.find((item) => item.id === activeProviderId) || options[0]?.provider;
  const model = data.model || getSelectedModel(provider, 'video') || options[0]?.model || '';
  const active = options.find((option) => option.provider.id === provider?.id && option.model === model);

  const createTask = () => {
    if (!active && (!provider || !model)) {
      updateNode(id, { error: '请先在设置 → API 与模型中添加视频模型' });
      return;
    }
    if (!data.prompt?.trim()) return;
    updateNode(id, { providerId: active?.provider.id || provider?.id, model, status: '任务已准备，可在视频工作台继续生成', error: undefined });
  };

  return (
    <BaseNode selected={selected} icon={Video} title="视频" width={420} showSourceHandle showTargetHandle onDelete={() => deleteNode(id)}>
      <div className="px-3 pb-3">
        <div className="flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/55">
          {data.previewUrl ? <video src={data.previewUrl} controls className="h-full min-h-[220px] w-full object-cover" /> : <div className="max-w-[240px] text-center text-muted-foreground"><Film size={25} className="mx-auto" /><p className="mt-3 text-xs font-medium">点击节点输入视频提示词</p></div>}
        </div>
        {selected && <div className="nodrag nowheel mt-3 w-full rounded-lg border border-border bg-background p-2 shadow-sm">
          <Textarea aria-label="视频生成提示词" value={data.prompt || ''} onChange={(event) => updateNode(id, { prompt: event.target.value })} placeholder="描述视频主题、动作与镜头节奏…" variant="ghost" className="nowheel h-16 min-h-0 w-full resize-none px-1 text-xs leading-5" />
          <div className="mt-2 flex items-center gap-2 border-t border-border/70 pt-2">
            <Select aria-label="选择视频模型" value={active ? active.provider.id + '::' + active.model : ''} onChange={(event) => { const [providerId, ...parts] = event.target.value.split('::'); updateNode(id, { providerId, model: parts.join('::') }); }} disabled={!options.length} selectSize="sm" className="min-w-0 flex-1 text-xs" options={options.length ? options.map((option) => ({ value: option.provider.id + '::' + option.model, label: option.model })) : [{ value: '', label: '暂无视频模型' }]} />
            <Button type="button" variant="primary" size="iconSm" onClick={createTask} disabled={!data.prompt?.trim()} aria-label="创建视频任务"><Send size={14} /></Button>
          </div>
          <div className="mt-2 flex items-center justify-between px-1 text-[11px] font-medium text-muted-foreground"><span className="truncate">{active?.provider.name || provider?.name || '未配置 Provider'}</span><span className="truncate font-mono">{model || '未选择模型'}</span></div>
          {data.status && <p role="status" className="mt-2 px-1 text-xs text-[#5d7700] dark:text-[#c8ff00]">{data.status}</p>}
          {data.error && <p role="alert" className="mt-2 px-1 text-xs text-red-600 dark:text-red-300">{data.error}</p>}
        </div>}
      </div>
    </BaseNode>
  );
});

VideoNode.displayName = 'VideoNode';
