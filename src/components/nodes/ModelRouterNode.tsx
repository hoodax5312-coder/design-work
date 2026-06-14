import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Ban, Braces, CheckCircle2, KeyRound, Network } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { ModelRouterNodeData } from '../../types/node.types';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { cn } from '../../lib/utils';

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
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-zinc-400">Provider</span>
            <select
              value={data.provider || 'Jimeng'}
              onChange={(event) => updateNode(id, { provider: event.target.value })}
              className="nodrag h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-zinc-400">请求模式</span>
            <select
              value={data.requestMode || 'async'}
              onChange={(event) => updateNode(id, { requestMode: event.target.value })}
              className="nodrag h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="async">异步轮询</option>
              <option value="sync">同步返回</option>
            </select>
          </label>
        </div>

        <label>
          <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-zinc-400">模型 ID</span>
          <input
            value={data.model || ''}
            onChange={(event) => updateNode(id, { model: event.target.value })}
            placeholder="例如 jimeng-4.5 / runway-gen3 / comfy-workflow"
            className="nodrag h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-zinc-400">Base URL / Endpoint</span>
          <input
            value={data.endpoint || ''}
            onChange={(event) => updateNode(id, { endpoint: event.target.value })}
            placeholder="https://api.example.com/v1"
            className="nodrag h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          <Metric icon={KeyRound} label="Key 轮换" value={data.keyRotation ? '开启' : '关闭'} active={!!data.keyRotation} />
          <Metric icon={Ban} label="黑名单" value={`${data.blacklistCount || 0}`} active={(data.blacklistCount || 0) > 0} />
          <Metric icon={CheckCircle2} label="状态" value="可路由" active />
        </div>

        <label>
          <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
            <Braces className="h-3 w-3" />
            请求模板预览
          </span>
          <textarea
            value={data.template || ''}
            onChange={(event) => updateNode(id, { template: event.target.value })}
            rows={5}
            className="nodrag w-full resize-none rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 font-mono text-[11px] leading-5 text-blue-100 outline-none focus:border-blue-400 dark:border-zinc-700"
          />
        </label>
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
  <div className={cn(
    'rounded-lg border p-2',
    active
      ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300'
      : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400',
  )}>
    <Icon className="mb-1 h-3.5 w-3.5" />
    <div className="text-[10px]">{label}</div>
    <div className="text-xs font-bold">{value}</div>
  </div>
);

ModelRouterNode.displayName = 'ModelRouterNode';
