import { memo } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { type ImageGenNodeData } from '../../types/node.types';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { cn } from '../../lib/utils';
import { CanvasPromptOverlay } from '../canvas/CanvasPromptOverlay';

type ImageNode = Node<ImageGenNodeData>;

export const ImageGenNode = memo(({ id, data, selected }: NodeProps<ImageNode>) => {
  const deleteNode = useCanvasStore((state) => state.deleteNode);

  return (
    <BaseNode selected={Boolean(selected)} icon={ImageIcon} title="图片" width={420} showTargetHandle showSourceHandle onDelete={() => deleteNode(id)}>
      <div className="px-3 pb-3">
        <div className={cn('relative flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-md bg-muted/55', data.imageUrl ? '' : 'border border-dashed border-border')}>
          {data.imageUrl ? <img src={data.imageUrl} alt={data.prompt || '生成图片'} className="h-full min-h-[220px] w-full object-cover" /> : (
            <div className="max-w-[240px] text-center text-muted-foreground">
              {data.isGenerating ? <Loader2 size={25} className="mx-auto animate-spin" /> : <Sparkles size={24} className="mx-auto" />}
              <p className="mt-3 text-xs font-medium">{data.isGenerating ? '正在生成画面…' : '点击节点输入图片提示词'}</p>
            </div>
          )}
        </div>
        <CanvasPromptOverlay node={{ id, type: 'imageGen', data } as unknown as Node} selected={Boolean(selected)} />

      </div>
    </BaseNode>
  );
});

ImageGenNode.displayName = 'ImageGenNode';
