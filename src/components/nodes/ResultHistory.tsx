import { useState } from 'react';
import { ChevronLeft, ChevronRight, Gallery } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '../ui';
import { activeResultOf, assetPreviewUrl, readResults, type CanvasResult } from '../canvas/canvasModel';

type MediaKind = 'imageGen' | 'video';

const URL_KEY: Record<MediaKind, 'imageUrl' | 'previewUrl'> = { imageGen: 'imageUrl', video: 'previewUrl' };

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
};

/** 结果缩略图：原地址失效时回退到资产库预览。 */
const ResultThumb = ({ result, kind }: { result: CanvasResult; kind: MediaKind }) => {
  const [failed, setFailed] = useState(false);
  if (kind === 'video' && !failed) {
    return <video src={result.url} muted preload="metadata" className="h-full w-full object-cover" onError={() => setFailed(true)} />;
  }
  const src = failed && result.assetId ? assetPreviewUrl(result.assetId, 256) : result.url;
  if (failed && !result.assetId) return <div className="h-full w-full bg-muted" />;
  return <img src={src} alt={result.prompt} draggable={false} className="h-full w-full object-cover" onError={() => setFailed(true)} />;
};

/**
 * 生成历史：每次生成的结果都会保留，可在卡片上前后切换，或在网格里挑一张设为当前结果。
 * 只有一条结果时不显示。
 */
export const ResultHistory = ({ id, kind, data }: { id: string; kind: MediaKind; data: Record<string, unknown> }) => {
  const updateNode = useCanvasStore((state) => state.updateNode);
  const [open, setOpen] = useState(false);
  const results = readResults(data);
  if (results.length < 2) return null;
  const key = URL_KEY[kind];
  const active = activeResultOf(data, key);
  const index = active ? results.indexOf(active) : results.length - 1;
  const generating = Boolean(data.isGenerating);

  const select = (result: CanvasResult) => {
    if (result.id === active?.id) return;
    updateNode(id, { [key]: result.url, activeResultId: result.id }, { history: true });
  };
  const step = (delta: number) => select(results[(index + delta + results.length) % results.length]);

  return (
    <div
      className={cn('canvas-result-switcher nodrag nopan', open && 'is-open')}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button type="button" aria-label="上一个结果" disabled={generating} onClick={() => step(-1)}><ChevronLeft size={14} /></button>
      <span className="min-w-[2.5rem] text-center tabular-nums">{index + 1}/{results.length}</span>
      <button type="button" aria-label="下一个结果" disabled={generating} onClick={() => step(1)}><ChevronRight size={14} /></button>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip content="全部结果" disabled={open}>
          <PopoverTrigger asChild>
            <button type="button" aria-label="查看全部结果"><Gallery size={13} /></button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent side="bottom" align="start" className="w-[296px] p-2">
          <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>生成历史 / {results.length}</span>
            <span>点选设为当前结果</span>
          </div>
          <div className="grid max-h-[300px] grid-cols-3 gap-1.5 overflow-y-auto">
            {[...results].reverse().map((result) => (
              <button
                key={result.id}
                type="button"
                title={[formatTime(result.createdAt), result.model].filter(Boolean).join(' / ')}
                onClick={() => { select(result); setOpen(false); }}
                className={cn(
                  'group relative aspect-square overflow-hidden rounded-md bg-muted outline-none ring-offset-1 ring-offset-popover transition-shadow focus-visible:ring-2 focus-visible:ring-ring',
                  result.id === active?.id && 'ring-2 ring-foreground',
                )}
              >
                <ResultThumb result={result} kind={kind} />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-3 text-left text-[10px] text-white">
                  {formatTime(result.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
