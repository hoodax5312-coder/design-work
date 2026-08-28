import { type ReactNode } from 'react';
import { RefreshCw, Download, Sparkles, BookmarkPlus } from '@/lib/remixIconShim';
import { Button } from '../ui';

interface PreviewPanelProps {
  title?: string;
  previewContent?: ReactNode;
  emptyState?: ReactNode;
  historyItems?: ReactNode;
  onRefresh?: () => void;
  onDownload?: () => void;
  onAddToAssets?: () => void;
  headerTabs?: ReactNode;
}

export function PreviewPanel({
  title = '预览',
  previewContent,
  emptyState,
  historyItems,
  onRefresh,
  onDownload,
  onAddToAssets,
  headerTabs,
}: PreviewPanelProps) {
  const hasContent = !!previewContent;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {headerTabs || (
          <h2 className="text-base font-medium text-foreground">
            {title}
          </h2>
        )}
        {hasContent && (
          <div className="flex gap-2">
            {onRefresh && (
              <Button type="button" variant="ghost" size="iconSm"
                onClick={onRefresh}
                className="h-8 w-8"
              >
                <RefreshCw size={18} />
              </Button>
            )}
            {onDownload && (
              <Button type="button" variant="ghost" size="iconSm"
                onClick={onDownload}
                className="h-8 w-8"
              >
                <Download size={18} />
              </Button>
            )}
            {onAddToAssets && (
              <Button type="button" variant="ghost" size="iconSm"
                onClick={onAddToAssets}
                title="添加到资产"
                className="h-8 w-8"
              >
                <BookmarkPlus size={18} />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main Preview */}
      <div className="mb-4 flex-1 rounded-md bg-muted/45 flex items-center justify-center overflow-hidden relative group">
        {hasContent ? (
          previewContent
        ) : (
          emptyState || (
            <div className="text-center">
              <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">快去开启你的创作之旅吧~</p>
            </div>
          )
        )}
      </div>

      {/* History */}
      {historyItems && (
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-foreground">
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
    <Button type="button" variant="secondary"
      onClick={onClick}
      className={`h-20 w-20 shrink-0 overflow-hidden rounded-md p-0 ${isActive ? 'border-2 border-primary' : ''}`}
    >
      <img src={src} className="w-full h-full object-cover" alt={alt} />
    </Button>
  );
}
