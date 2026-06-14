import { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { VideoNodeData } from '../../types/node.types';
import { Film, Upload } from 'lucide-react';
import { BaseNode } from './BaseNode';

type VideoNode = Node<VideoNodeData>;

export const VideoNode = memo(({ data, selected }: NodeProps<VideoNode>) => {
  return (
    <BaseNode
      selected={selected}
      theme="blue"
      icon={Film}
      title="视频输入"
      width={280}
      showSourceHandle
      showTargetHandle={false}
    >
      <div className="p-4">
        {data.previewUrl ? (
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
            <video
              src={data.previewUrl}
              controls
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="aspect-video bg-slate-50 dark:bg-slate-800 rounded-lg flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 gap-2">
            <Upload className="text-slate-400" size={24} />
            <span className="text-slate-500 dark:text-slate-400 text-xs">
              上传视频
            </span>
          </div>
        )}

        <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
          {data.prompt && (
            <div className="flex justify-between">
              <span>提示词:</span>
              <span className="text-slate-600 dark:text-slate-300 truncate max-w-[160px]">
                {data.prompt}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span>模型:</span>
            <span className="text-slate-600 dark:text-slate-300">{data.model}</span>
          </div>
        </div>
      </div>
    </BaseNode>
  );
});

VideoNode.displayName = 'VideoNode';
