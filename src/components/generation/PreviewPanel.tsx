import { type ReactNode } from 'react';
import { RefreshCw, Download, Sparkles } from 'lucide-react';

interface PreviewPanelProps {
  title?: string;
  previewContent?: ReactNode;
  emptyState?: ReactNode;
  historyItems?: ReactNode;
  onRefresh?: () => void;
  onDownload?: () => void;
  headerTabs?: ReactNode;
}

export function PreviewPanel({
  title = '预览',
  previewContent,
  emptyState,
  historyItems,
  onRefresh,
  onDownload,
  headerTabs,
}: PreviewPanelProps) {
  const hasContent = !!previewContent;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {headerTabs || (
          <h2 className="text-base font-medium text-[#1d2531] dark:text-white">
            {title}
          </h2>
        )}
        {hasContent && (
          <div className="flex gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <RefreshCw size={18} />
              </button>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <Download size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Preview */}
      <div className="flex-1 bg-[#f7f9fa] dark:bg-black/20 rounded-lg flex items-center justify-center mb-4 overflow-hidden relative group">
        {hasContent ? (
          previewContent
        ) : (
          emptyState || (
            <div className="text-center">
              <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">快去开启你的创作之旅吧~</p>
            </div>
          )
        )}
      </div>

      {/* History */}
      {historyItems && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-[#1d2531] dark:text-slate-200">
            生成记录
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">{historyItems}</div>
        </div>
      )}
    </>
  );
}

interface HistoryThumbnailProps {
  src: string;
  alt?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function HistoryThumbnail({
  src,
  alt = 'history item',
  isActive = false,
  onClick,
}: HistoryThumbnailProps) {
  return (
    <div
      onClick={onClick}
      className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer transition-colors ${
        isActive
          ? 'border-2 border-[#551db0]'
          : 'border border-slate-200 dark:border-zinc-700 hover:border-[#551db0]'
      }`}
    >
      <img src={src} className="w-full h-full object-cover" alt={alt} />
    </div>
  );
}
