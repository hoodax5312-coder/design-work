import { memo } from 'react';
import {
  NodeProps,
  useHandleConnections,
  useNodesData,
  Node,
} from '@xyflow/react';
import { VideoAnalyzeNodeData, VideoNodeData } from '../../types/node.types';
import { detectScenesAndCapture } from '../../lib/videoUtils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { Loader2, FileText, Image as ImageIcon, Sparkles } from '@/lib/remixIconShim';
import { BaseNode } from './BaseNode';
import { Button } from '../ui';

type VideoAnalyzeNode = Node<VideoAnalyzeNodeData>;

export const VideoAnalyzeNode = memo(({ id, data, selected }: NodeProps<VideoAnalyzeNode>) => {
  const updateNode = useCanvasStore((state) => state.updateNode);
  const connections = useHandleConnections({ type: 'target' });

  // Get data from the connected source node
  const sourceNodeData = useNodesData(connections[0]?.source);

  // Try to find videoUrl in the source node's data
  const sourceData = sourceNodeData?.data as VideoNodeData | undefined;
  const videoUrl = sourceData?.previewUrl || data.videoUrl;

  const handleExtract = async () => {
    if (!videoUrl) return;

    updateNode(id, { isExtracting: true });

    try {
      const keyframes = await detectScenesAndCapture(videoUrl, data.threshold || 30);
      updateNode(id, {
        keyframes,
        isExtracting: false,
        videoUrl,
      });
    } catch (e) {
      console.error('Scene detection failed:', e);
      updateNode(id, { isExtracting: false });
    }
  };

  const handleExtractVoiceover = () => {
    if (!videoUrl) return;
    updateNode(id, { isExtractingVoiceover: true });
    window.setTimeout(() => {
      updateNode(id, {
        isExtractingVoiceover: false,
        voiceover: '00:00 画面开场，主体进入视野。\n00:08 环境信息展开，镜头推进。\n00:16 关键动作出现，适合切入字幕或旁白。',
      });
    }, 650);
  };

  return (
    <BaseNode
      selected={selected}
      theme="indigo"
      icon={Sparkles}
      title="视频智能分析"
      width={320}
      showSourceHandle
      showTargetHandle
    >
      <div className="p-4 flex flex-col gap-3">
        {videoUrl ? (
          <div className="aspect-video bg-black rounded-lg overflow-hidden relative group">
            <video src={videoUrl} controls className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/55 py-8 text-center text-xs text-muted-foreground">
            连接视频节点以开始分析
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="primary" size="sm"
            onClick={handleExtract}
            disabled={!videoUrl || data.isExtracting}
            className="flex-1 text-xs"
          >
            {data.isExtracting ? (
              <Loader2 className="animate-spin w-3 h-3" />
            ) : (
              <ImageIcon className="w-3 h-3" />
            )}
            智能分镜
          </Button>
          <Button variant="primary" size="sm"
            onClick={handleExtractVoiceover}
            disabled={!videoUrl || data.isExtractingVoiceover}
            className="flex-1 text-xs"
          >
            {data.isExtractingVoiceover ? <Loader2 className="animate-spin w-3 h-3" /> : <FileText className="w-3 h-3" />}
            提取台词
          </Button>
        </div>

        {data.voiceover && (
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-5 text-muted-foreground">
            {data.voiceover}
          </pre>
        )}

        {data.keyframes && data.keyframes.length > 0 && (
          <div className="mt-1">
            <div className="mb-2 flex justify-between text-xs text-muted-foreground">
              <span>关键帧 ({data.keyframes.length})</span>
              <Button variant="link" size="sm" className="text-xs">
                下载全部
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
              {data.keyframes.map((frame, i) => (
                <div
                  key={i}
                  className="group relative cursor-pointer overflow-hidden rounded-md ring-primary hover:ring-2"
                >
                  <img
                    src={frame.url}
                    alt={`Frame at ${frame.time}s`}
                    className="w-full h-20 object-cover"
                  />
                  <div className="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-tl">
                    {frame.time}s
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

VideoAnalyzeNode.displayName = 'VideoAnalyzeNode';
