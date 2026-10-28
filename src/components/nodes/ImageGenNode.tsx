import { memo, useState } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { Copy, Download, ImagePlus, Maximize, RefreshCw, Settings2, Scissors } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { type ImageGenNodeData } from '../../types/node.types';
import { AuroraVeil, ShimmerText, ThinkingOrb } from '../motion';
import { activeResultOf, clampCount, nodeTitle, ratioToCss } from '../canvas/canvasModel';
import { useCanvasActions } from '../canvas/canvasContext';
import { downloadOriginalImage, imageAspectRatio, recordImageDimensions } from '../canvas/imageAsset';
import { isNodeRunnable, runNodeGeneration } from '../canvas/generation';
import { derivedImageNode } from '../canvas/imageInputs';
import { NodeFrame, type NodeAction } from './NodeFrame';
import { ResultHistory } from './ResultHistory';
import { useMediaFallback } from './useMediaFallback';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui';
import { ImageToolsDialog, type ImageTool } from './ImageToolsDialog';

type ImageNode = Node<ImageGenNodeData>;

export const ImageGenNode = memo(({ id, data, selected }: NodeProps<ImageNode>) => {
  const [showParameters, setShowParameters] = useState(false);
  const [imageTool, setImageTool] = useState<ImageTool>();
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
  const assetId = active ? active.assetId : typeof data.assetId === 'string' ? data.assetId : undefined;
  const media = useMediaFallback(imageUrl, assetId);
  const shown = media.dead ? '' : media.src;
  const count = clampCount(data.count);
  const snapshot = active?.generationSnapshot;

  const actions: NodeAction[] = [
    {
      id: 'image-tools', icon: Scissors, label: '图片工具：裁切、遮罩、切图、超分', disabled: uploading || generating || !assetId,
      onSelect: () => setImageTool('crop'),
    },
    {
      id: 'continue-edit', icon: ImagePlus, label: '继续改图', disabled: uploading || generating || !assetId,
      onSelect: () => {
        try {
          const { nodes, addNodes } = useCanvasStore.getState();
          const source = nodes.find((node) => node.id === id);
          if (!source) return;
          const derived = derivedImageNode(source, nodes);
          addNodes([derived.node], [derived.edge]);
          notify('已新建下游图片节点，请填写修改要求；生成时使用上游当前选中的图片');
        } catch (error) { notify(error instanceof Error ? error.message : '无法继续改图'); }
      },
    },
    {
      id: 'parameters', icon: Settings2, label: '查看生成参数', disabled: !snapshot,
      onSelect: () => setShowParameters(true),
    },
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
      label: '下载原图',
      disabled: !imageUrl && !assetId,
      onSelect: () => void downloadOriginalImage(assetId, imageUrl, title).catch((error: unknown) => notify(error instanceof Error ? error.message : '原图下载失败')),
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
      cardStyle={{ aspectRatio: imageAspectRatio(active ? active.width : data.imageWidth, active ? active.height : data.imageHeight, ratioToCss(data.aspectRatio)) }}
      actions={actions}
    >
      {shown ? (
        <img
          key={shown}
          src={shown}
          alt={prompt || title}
          draggable={false}
          onError={media.onError}
          onLoad={(event) => { if (shown === imageUrl) recordImageDimensions(id, imageUrl, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight); }}
          onDoubleClick={() => openMedia({ kind: 'image', url: shown, title })}
          className={cn('canvas-media-enter h-full w-full object-contain transition-[filter,opacity] duration-300', (generating || uploading) && 'opacity-70 blur-[2px]')}
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
      {imageTool && assetId && <ImageToolsDialog key={`${imageTool}:${assetId}`} nodeId={id} assetId={assetId} tool={imageTool} onToolChange={setImageTool} onClose={() => setImageTool(undefined)} onSaved={notify} />}
      <Dialog open={showParameters} onOpenChange={setShowParameters}>
        <DialogContent className="nodrag nopan max-h-[80dvh] overflow-y-auto" onPointerDown={(event) => event.stopPropagation()}>
          <DialogTitle>本次生成参数</DialogTitle>
          <DialogDescription>记录提交时的参数与参考，不随当前编辑改变；供应商及模型变化后不保证逐像素复现。</DialogDescription>
          {snapshot && <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 break-all text-sm">
              {[
                ['模型', snapshot.model], ['厂商 / 协议', `${snapshot.providerId} / ${snapshot.protocol}`],
                ['请求尺寸 / 比例', `${snapshot.size} / ${snapshot.aspectRatio}`],
                ['质量', ({ standard: '标准', hd: '高清', medium: '中', high: '高', low: '低', auto: '自动' } as Record<string, string>)[snapshot.quality] || snapshot.quality], ['本批数量', `${snapshot.count} 张（每张独立请求）`],
                ['参考图', snapshot.referenceImage ? `${snapshot.referenceImage.name} / ${snapshot.referenceImage.assetId}` : '无'],
              ].map(([label, value]) => <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <div className="text-sm"><p className="mb-2 text-muted-foreground">实际发送提示词（含上游文本）</p><p className="whitespace-pre-wrap break-words">{snapshot.prompt}</p></div>
          </>}
        </DialogContent>
      </Dialog>
    </NodeFrame>
  );
});

ImageGenNode.displayName = 'ImageGenNode';
