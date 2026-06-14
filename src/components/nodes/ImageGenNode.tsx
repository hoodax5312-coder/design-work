import { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { ImageGenNodeData } from '../../types/node.types';
import { Wand2 } from 'lucide-react';
import { BaseNode } from './BaseNode';

type ImageGenNode = Node<ImageGenNodeData>;

export const ImageGenNode = memo(({ data, selected }: NodeProps<ImageGenNode>) => {
  return (
    <BaseNode
      selected={selected}
      theme="purple"
      icon={Wand2}
      title="图像生成"
      width={280}
      showSourceHandle
      showTargetHandle
    >
      <div className="p-4">
        {data.imageUrl ? (
          <div className="aspect-square bg-black rounded-lg overflow-hidden relative group">
            <img
              src={data.imageUrl}
              alt="Generated"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ) : (
          <div className="aspect-square bg-slate-50 dark:bg-slate-800 rounded-lg flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 p-4 text-center">
            <Wand2 className="text-slate-400 mb-2" size={24} />
            <span className="text-slate-500 dark:text-slate-400 text-xs">
              等待生成...
            </span>
          </div>
        )}

        <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
          {data.prompt && (
            <div className="line-clamp-2 italic text-slate-600 dark:text-slate-300">
              "{data.prompt}"
            </div>
          )}
          <div className="flex justify-between pt-1">
            <span>模型: {data.model}</span>
            <span>{data.resolution}</span>
          </div>
        </div>
      </div>
    </BaseNode>
  );
});

ImageGenNode.displayName = 'ImageGenNode';
