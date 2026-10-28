import { FavoriteIcon } from '../ui/FavoriteIcon';
import type { MouseEvent } from 'react';
import { Copy, Download, Pencil } from '@/lib/remixIconShim';
import { Button } from '../ui/Button';
import type { GenerationRecord } from './generationHistory';

interface GenerationHistoryGridProps {
  records: GenerationRecord[];
  savedUrls: Set<string>;
  onOpen: (url: string) => void;
  onContextMenu: (url: string, event: MouseEvent<HTMLElement>) => void;
  onEdit: (record: GenerationRecord) => void;
  onCopy: (record: GenerationRecord) => void;
  onSave: (url: string, record: GenerationRecord) => void;
  onDownload: (url: string) => void;
}

export const GenerationHistoryGrid = ({ records, savedUrls, onOpen, onContextMenu, onEdit, onCopy, onSave, onDownload }: GenerationHistoryGridProps) => (
  <div aria-label="历史记录宫格" className="columns-[180px] gap-3 p-2">
    {records.flatMap((record) => record.outputs.map((url, index) => (
      <article key={`${record.id}-${index}`} className="group relative mb-3 break-inside-avoid overflow-hidden rounded-lg bg-muted">
        <button
          type="button"
          aria-label={`全屏查看${record.mode === 'video' ? '视频' : '图片'}：${record.prompt}（第 ${index + 1} 张）`}
          onClick={() => onOpen(url)}
          onContextMenu={record.mode === 'video' ? undefined : (event) => onContextMenu(url, event)}
          className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {record.mode === 'video'
            ? <video src={url} preload="metadata" muted playsInline className="aspect-video w-full object-contain" />
            : <img src={url} alt={record.prompt} loading="lazy" className="h-auto w-full" />}
        </button>
        {savedUrls.has(url) && <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[11px] text-white">已收藏</span>}
        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 pt-5 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <Button type="button" variant="ghost" size="iconSm" aria-label="编辑提示词" title="编辑提示词" onClick={() => onEdit(record)} className="h-7 w-7 p-0 hover:bg-white/20 hover:text-white"><Pencil size={14} /></Button>
          <Button type="button" variant="ghost" size="iconSm" aria-label="复制提示词" title="复制提示词" onClick={() => onCopy(record)} className="h-7 w-7 p-0 hover:bg-white/20 hover:text-white"><Copy size={14} /></Button>
          <Button type="button" variant="ghost" size="iconSm" aria-label={savedUrls.has(url) ? '取消收藏' : '添加至收藏'} title={savedUrls.has(url) ? '取消收藏' : '添加至收藏'} aria-pressed={savedUrls.has(url)} onClick={() => onSave(url, record)} className="h-7 w-7 p-0 hover:bg-white/20 hover:text-white disabled:opacity-100"><FavoriteIcon saved={savedUrls.has(url)} size={14} /></Button>
          <Button type="button" variant="ghost" size="iconSm" aria-label={record.mode === 'video' ? '下载视频' : '下载图片'} title="下载" onClick={() => onDownload(url)} className="h-7 w-7 p-0 hover:bg-white/20 hover:text-white"><Download size={14} /></Button>
        </div>
      </article>
    )))}
  </div>
);
