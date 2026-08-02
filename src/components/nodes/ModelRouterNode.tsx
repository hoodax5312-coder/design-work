import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Ban, CheckCircle2, KeyRound, Network } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { ModelRouterNodeData } from '../../types/node.types';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { cn } from '../../lib/utils';
import { Card, Input, Select, Textarea } from '../ui';

type ModelRouterNode = Node<ModelRouterNodeData>;

const providers: ModelRouterNodeData['provider'][] = ['Jimeng', 'ComfyUI', 'Runway', 'OpenAI', 'Custom'];

export const ModelRouterNode = memo(({ id, data, selected }: NodeProps<ModelRouterNode>) => {
  const updateNode = useCanvasStore((state) => state.updateNode);

  return (
    <BaseNode
      selected={selected}
      theme="blue"
      icon={Network}
      title="模型路由"
      width={360}
      showSourceHandle
      showTargetHandle
    >
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Select
              label="Provider"
              value={data.provider || 'Jimeng'}
              onChange={(event) => updateNode(id, { provider: event.target.value })}
              selectSize="sm"
              className="nodrag text-xs"
              options={providers.map((provider) => ({ value: provider, label: provider }))}
          />
          <Select
              label="请求模式"
              value={data.requestMode || 'async'}
              onChange={(event) => updateNode(id, { requestMode: event.target.value })}
              selectSize="sm" className="nodrag text-xs"
              options={[{ value: 'async', label: '异步轮询' }, { value: 'sync', label: '同步返回' }]}
          />
        </div>

        <Input label="模型 ID" inputSize="sm"
            value={data.model || ''}
            onChange={(event) => updateNode(id, { model: event.target.value })}
            placeholder="例如 jimeng-4.5 / runway-gen3 / comfy-workflow"
            className="nodrag text-xs"
          />

        <Input label="Base URL / Endpoint" inputSize="sm"
            value={data.endpoint || ''}
            onChange={(event) => updateNode(id, { endpoint: event.target.value })}
            placeholder="https://api.example.com/v1"
            className="nodrag text-xs"
          />

        <div className="grid grid-cols-3 gap-2">
          <Metric icon={KeyRound} label="Key 轮换" value={data.keyRotation ? '开启' : '关闭'} active={!!data.keyRotation} />
          <Metric icon={Ban} label="黑名单" value={`${data.blacklistCount || 0}`} active={(data.blacklistCount || 0) > 0} />
          <Metric icon={CheckCircle2} label="状态" value="可路由" active />
        </div>

        <Textarea label="请求模板预览"
            value={data.template || ''}
            onChange={(event) => updateNode(id, { template: event.target.value })}
            rows={5}
            className="nodrag font-mono text-xs leading-5"
          />
      </div>
    </BaseNode>
  );
});

const Metric = ({
  icon: Icon,
  label,
  value,
  active,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  active?: boolean;
}) => (
  <Card padding="sm" className={cn(
    active
      ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300'
      : 'text-muted-foreground',
  )}>
    <Icon className="mb-1 h-3.5 w-3.5" />
    <div className="text-xs">{label}</div>
    <div className="text-xs font-bold">{value}</div>
  </Card>
);

ModelRouterNode.displayName = 'ModelRouterNode';
