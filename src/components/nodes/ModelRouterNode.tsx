import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/Select';
import { Label } from '../ui/Label';
import { useId, memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Ban, CheckCircle2, KeyRound, Network } from '@/lib/remixIconShim';
import { BaseNode } from './BaseNode';
import { ModelRouterNodeData } from '../../types/node.types';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { cn } from '../../lib/utils';
import { Card, Input, Textarea } from '../ui';

type ModelRouterNode = Node<ModelRouterNodeData>;

const providers: ModelRouterNodeData['provider'][] = ['Jimeng', 'ComfyUI', 'Runway', 'OpenAI', 'Custom'];

export const ModelRouterNode = memo(({ id, data, selected }: NodeProps<ModelRouterNode>) => {
  const fieldId1 = useId();
  const fieldId2 = useId();
  const fieldId3 = useId();
  const fieldId4 = useId();
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
          <div className="w-full">
            <Label htmlFor={fieldId1} className="mb-1.5 block text-sm font-medium text-foreground">
              Provider
            </Label>
            <Select
              value={data.provider || 'Jimeng'}
              onValueChange={(value) => updateNode(id, { provider: value })}
            >
              <SelectTrigger id={fieldId1} className="h-8 text-xs nodrag text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers
                  .map((provider) => ({ value: provider, label: provider }))
                  .map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full">
            <Label htmlFor={fieldId2} className="mb-1.5 block text-sm font-medium text-foreground">
              请求模式
            </Label>
            <Select
              value={data.requestMode || 'async'}
              onValueChange={(value) => updateNode(id, { requestMode: value })}
            >
              <SelectTrigger id={fieldId2} className="h-8 text-xs nodrag text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: 'async', label: '异步轮询' },
                  { value: 'sync', label: '同步返回' },
                ].map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="w-full">
          <Label htmlFor={fieldId3} className="mb-1.5 block text-sm font-medium text-foreground">
            模型 ID
          </Label>
          <Input
            id={fieldId3}
            inputSize="sm"
            value={data.model || ''}
            onChange={(event) => updateNode(id, { model: event.target.value })}
            placeholder="例如 jimeng-4.5 / runway-gen3 / comfy-workflow"
            className="nodrag text-xs"
          />
        </div>

        <div className="w-full">
          <Label htmlFor={fieldId4} className="mb-1.5 block text-sm font-medium text-foreground">
            Base URL / Endpoint
          </Label>
          <Input
            id={fieldId4}
            inputSize="sm"
            value={data.endpoint || ''}
            onChange={(event) => updateNode(id, { endpoint: event.target.value })}
            placeholder="https://api.example.com/v1"
            className="nodrag text-xs"
          />
        </div>

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
      ? 'border-primary/30 bg-primary/10 text-primary'
      : 'text-muted-foreground',
  )}>
    <Icon className="mb-1 h-3.5 w-3.5" />
    <div className="text-xs">{label}</div>
    <div className="text-xs font-bold">{value}</div>
  </Card>
);

ModelRouterNode.displayName = 'ModelRouterNode';
