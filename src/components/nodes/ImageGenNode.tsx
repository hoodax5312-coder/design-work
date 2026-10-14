import { memo } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { Copy, Download, ImagePlus, Maximize, RefreshCw } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { type ImageGenNodeData } from '../../types/node.types';
import { AuroraVeil, ShimmerText, ThinkingOrb } from '../motion';
import { CanvasPromptOverlay } from '../canvas/CanvasPromptOverlay';
import { activeResultOf, clampCount, nodeTitle, ratioToCss } from '../canvas/canvasModel';
import { downloadMedia, useCanvasActions } from '../canvas/canvasContext';
import { isNodeRunnable, runNodeGeneration } from '../canvas/generation';
import { NodeFrame, type NodeAction } from './NodeFrame';
import { ResultHistory } from './ResultHistory';
import { useMediaFallback } from './useMediaFallback';

type ImageNode = Node<ImageGenNodeData>;

const extensionOf = (url: string) => (url.includes('/api/assets/') ? 'webp' : url.startsWith('data:image/jpeg') ? 'jpg' : 'png');

export const ImageGenNode = memo(({ id, data, selected }: NodeProps<ImageNode>) => {
  const single = useCanvasStore((state) => state.selectedNodes.length <= 1);
  const runnable = useCanvasStore((state) => {
    const node = state.nodes.find((item) => item.id === id);
    return Boolean(node) && isNodeRunnable(node as Node, state.nodes, state.edges);
  });
  const { notify, openMedia } = useCanvasActions();
  const imageUrl = String(data.imageUrl || '');
  const prompt = String(data.prompt || '');
  const generating = Boolean(data.isGenerating);
  const uploading = Boolean(data.uploading);
  const isSelected = Boolean(selected);
  const title = nodeTitle({ type: 'imageGen', data });
  const active = activeResultOf(data, 'imageUrl');
  const media = useMediaFallback(imageUrl, active?.assetId || (typeof data.assetId === 'string' ? data.assetId : undefined));
  const shown = media.dead ? '' : media.src;
  const count = clampCount(data.count);

  const actions: NodeAction[] = [
    {
      id: 'regenerate',
      icon: RefreshCw,
      label: imageUrl ? `重新生成${count > 1 ? ` ${count} 张` : ''}` : '生成',
      disabled: uploading || !runnable,
      onSelect: () => void runNodeGeneration(id),
    },
    { id: 'view', icon: Maximize, label: '全屏查看', disabled: !shown, onSelect: () => openMedia({ kind: 'image', url: shown, title }) },
    {
      id: 'download',
      icon: Download,
      label: '下载',
      disabled: !shown,
      onSelect: () => void downloadMedia(shown, `${title}.${extensionOf(shown)}`).then((ok) => { if (!ok) notify('已在新标签页打开图片，可在那里另存'); }),
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
      kind="imageGen"
      data={data}
      selected={isSelected}
      resize="width"
      cardStyle={{ aspectRatio: ratioToCss(data.aspectRatio) }}
      actions={actions}
      panel={<CanvasPromptOverlay id={id} kind="imageGen" data={data} visible={isSelected && single} />}
    >
      {shown ? (
        <img
          key={shown}
          src={shown}
          alt={prompt || title}
          draggable={false}
          onError={media.onError}
          onDoubleClick={() => openMedia({ kind: 'image', url: shown, title })}
          className={cn('canvas-media-enter h-full w-full object-cover transition-[filter,opacity] duration-300', (generating || uploading) && 'opacity-70 blur-[2px]')}
        />
      ) : !generating && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground">
          <ImagePlus size={22} className="opacity-70" />
          {media.dead ? (
            <span className="max-w-[80%] text-center text-xs leading-5">图片地址已失效，可重新生成</span>
          ) : prompt.trim() && !isSelected ? (
            <span className="line-clamp-4 max-w-[80%] whitespace-pre-wrap break-words text-center text-xs leading-5 text-foreground/70">{prompt}</span>
          ) : (
            <span className="text-xs">{isSelected ? '在下方描述画面' : '选中后输入提示词'}</span>
          )}
        </div>
      )}
      {uploading && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-3">
          <ShimmerText className="rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium backdrop-blur">正在存入资产库…</ShimmerText>
        </div>
      )}
      {generating && (
        <>
          <AuroraVeil />
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-2">
              <ThinkingOrb size={44} />
              {count > 1 && <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground backdrop-blur">{count} 张并行生成</span>}
            </div>
          </div>
        </>
      )}
      <ResultHistory id={id} kind="imageGen" data={data} />
    </NodeFrame>
  );
});

ImageGenNode.displayName = 'ImageGenNode';
