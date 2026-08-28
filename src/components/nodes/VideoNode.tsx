import { memo } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { Film, Video } from '@/lib/remixIconShim';
import { BaseNode } from './BaseNode';
import { type VideoNodeData } from '../../types/node.types';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { CanvasPromptOverlay } from '../canvas/CanvasPromptOverlay';

type CanvasVideoNode = Node<VideoNodeData>;

export const VideoNode = memo(({ id, data, selected }: NodeProps<CanvasVideoNode>) => {
  const deleteNode = useCanvasStore((state) => state.deleteNode);

  return (
    <BaseNode selected={Boolean(selected)} icon={Video} title="视频" width={420} showSourceHandle showTargetHandle onDelete={() => deleteNode(id)}>
      <div className="px-3 pb-3">
        <div className="flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/55">
          {data.previewUrl ? <video src={data.previewUrl} controls className="h-full min-h-[220px] w-full object-cover" /> : <div className="max-w-[240px] text-center text-muted-foreground"><Film size={25} className="mx-auto" /><p className="mt-3 text-xs font-medium">点击节点输入视频提示词</p></div>}
        </div>
        <CanvasPromptOverlay node={{ id, type: 'video', data } as unknown as Node} selected={Boolean(selected)} />
      </div>
    </BaseNode>
  );
});

VideoNode.displayName = 'VideoNode';
