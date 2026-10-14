import { memo, useRef } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { Copy, Download, Film, Maximize, Play, RefreshCw } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { type VideoNodeData } from '../../types/node.types';
import { AuroraVeil, ThinkingOrb } from '../motion';
import { CanvasPromptOverlay } from '../canvas/CanvasPromptOverlay';
import { nodeTitle, ratioToCss } from '../canvas/canvasModel';
import { downloadMedia, useCanvasActions } from '../canvas/canvasContext';
import { isNodeRunnable, runNodeGeneration } from '../canvas/generation';
import { NodeFrame, type NodeAction } from './NodeFrame';
import { ResultHistory } from './ResultHistory';
import { useMediaFallback } from './useMediaFallback';

type CanvasVideoNode = Node<VideoNodeData>;

export const VideoNode = memo(({ id, data, selected }: NodeProps<CanvasVideoNode>) => {
  const single = useCanvasStore((state) => state.selectedNodes.length <= 1);
  const runnable = useCanvasStore((state) => {
    const node = state.nodes.find((item) => item.id === id);
    return Boolean(node) && isNodeRunnable(node as Node, state.nodes, state.edges);
  });
  const { notify, openMedia } = useCanvasActions();
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewUrl = String(data.previewUrl || '');
  const prompt = String(data.prompt || '');
  const generating = Boolean(data.isGenerating);
  const isSelected = Boolean(selected);
  const title = nodeTitle({ type: 'video', data });
  // 资产库只有视频的封面图预览，不能代替视频本身，所以视频不回退到资产预览。
  const media = useMediaFallback(previewUrl);
  const shown = media.dead ? '' : previewUrl;

  const actions: NodeAction[] = [
    {
      id: 'regenerate',
      icon: RefreshCw,
      label: previewUrl ? '重新生成' : '生成',
      disabled: data.source === 'upload' || !runnable,
      onSelect: () => void runNodeGeneration(id),
    },
    { id: 'view', icon: Maximize, label: '全屏播放', disabled: !shown, onSelect: () => openMedia({ kind: 'video', url: shown, title }) },
    {
      id: 'download',
      icon: Download,
      label: '下载',
      disabled: !shown,
      onSelect: () => void downloadMedia(shown, `${title}.mp4`).then((ok) => { if (!ok) notify('已在新标签页打开视频，可在那里另存'); }),
    },
    {
      id: 'copy-prompt',
      icon: Copy,
      label: '复制提示词',
      disabled: !prompt.trim(),
      onSelect: () => void navigator.clipboard.writeText(prompt).then(() => notify('已复制提示词'), () => notify('复制失败')),
    },
  ];

  return (
    <NodeFrame
      id={id}
      kind="video"
      data={data}
      selected={isSelected}
      resize="width"
      cardStyle={{ aspectRatio: ratioToCss(data.aspectRatio) }}
      actions={actions}
      panel={<CanvasPromptOverlay id={id} kind="video" data={data} visible={isSelected && single} />}
    >
      {shown ? (
        <div
          className="group/video relative h-full w-full bg-black"
          onMouseEnter={() => void videoRef.current?.play().catch(() => undefined)}
          onMouseLeave={() => videoRef.current?.pause()}
          onDoubleClick={() => openMedia({ kind: 'video', url: shown, title })}
        >
          <video
            key={shown}
            ref={videoRef}
            src={shown}
            muted
            loop
            playsInline
            preload="metadata"
            controls={isSelected}
            onError={media.onError}
            className={cn('canvas-media-enter h-full w-full object-cover', isSelected && 'nodrag', generating && 'opacity-60')}
          />
          {!isSelected && (
            <span className="pointer-events-none absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition-opacity group-hover/video:opacity-0">
              <Play size={13} />
            </span>
          )}
        </div>
      ) : !generating && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground">
          <Film size={22} className="opacity-70" />
          {media.dead ? (
            <span className="max-w-[80%] text-center text-xs leading-5">视频地址已失效，可重新生成</span>
          ) : prompt.trim() && !isSelected ? (
            <span className="line-clamp-4 max-w-[80%] whitespace-pre-wrap break-words text-center text-xs leading-5 text-foreground/70">{prompt}</span>
          ) : (
            <span className="text-xs">{isSelected ? '在下方描述镜头与动作' : '选中后输入提示词'}</span>
          )}
        </div>
      )}
      {generating && (
        <>
          <AuroraVeil />
          <div className="absolute inset-0 grid place-items-center"><ThinkingOrb size={44} /></div>
        </>
      )}
      <ResultHistory id={id} kind="video" data={data} />
    </NodeFrame>
  );
});

VideoNode.displayName = 'VideoNode';
