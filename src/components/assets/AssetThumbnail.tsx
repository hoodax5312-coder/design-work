import { useEffect, useState } from 'react';
import { AudioLines, File, FileText, Film, Image as ImageIcon, Loader2, Presentation } from '@/lib/remixIconShim';
import { assetService, waitForTask } from '../../services/assetService';
import type { AssetSummary } from '../../types/asset.types';
import { cn } from '../../lib/utils';

const TypeIcon = ({ type }: { type: string }) => {
  if (type === 'image') return <ImageIcon size={24} />;
  if (type === 'video') return <Film size={24} />;
  if (type === 'audio') return <AudioLines size={24} />;
  if (type === 'ppt') return <Presentation size={24} />;
  if (type === 'knowledge') return <FileText size={24} />;
  return <File size={24} />;
};

export const AssetThumbnail = ({
  asset,
  onReady,
  fit = 'contain',
}: {
  asset: AssetSummary;
  onReady?: () => void;
  fit?: 'cover' | 'contain';
}) => {
  const generatedUrl = typeof asset.userMetadata?.generatedUrl === 'string'
    ? asset.userMetadata.generatedUrl
    : '';
  const generatedSourceStatus = asset.userMetadata?.generatedSourceStatus;
  const isUnrecoverable = asset.previewStatus === 'unrecoverable' || generatedSourceStatus === 'unrecoverable';
  const isFeedItem = asset.userMetadata?.feedItem === true;
  const remotePreviewUrl = generatedUrl || asset.previewUrl;
  const [state, setState] = useState<'missing' | 'loading' | 'local-ready' | 'remote-ready' | 'failed'>(
    isUnrecoverable
      ? 'failed'
      : asset.previewStatus === 'ready'
      ? 'local-ready'
      : asset.previewStatus === 'remote'
        ? 'remote-ready'
        : 'missing',
  );
  const [version, setVersion] = useState(asset.updatedAt);
  const localPreviewUrl = asset.previewUrl || `/api/assets/${asset.id}/preview?size=512&v=${version}`;

  useEffect(() => {
    setVersion(asset.updatedAt);
    setState(
      asset.previewStatus === 'unrecoverable' || generatedSourceStatus === 'unrecoverable'
        ? 'failed'
        : asset.previewStatus === 'ready'
        ? 'local-ready'
        : asset.previewStatus === 'remote'
          ? 'remote-ready'
          : 'missing',
    );
  }, [asset.id, asset.previewStatus, asset.updatedAt, generatedSourceStatus, isFeedItem, isUnrecoverable]);

  useEffect(() => {
    if (asset.type !== 'image' || state !== 'missing' || isUnrecoverable || isFeedItem) return;
    const controller = new AbortController();
    setState('loading');
    assetService
      .requestPreview(asset.id)
      .then(({ id }) => waitForTask(id, undefined, controller.signal))
      .then((task) => {
        if (task.status === 'completed') {
          setVersion(Date.now());
          setState('local-ready');
          onReady?.();
        } else {
          setState('failed');
        }
      })
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') {
          setState('failed');
        }
      });
    return () => controller.abort();
  }, [asset.id, asset.previewStatus, asset.type, isFeedItem, isUnrecoverable, onReady, state]);

  if ((state === 'local-ready' || state === 'remote-ready') && asset.type === 'image') {
    return (
      <img
        src={state === 'local-ready' ? localPreviewUrl : remotePreviewUrl}
        alt=""
        loading="lazy"
        className={cn(
          'w-full rounded-md transition-transform duration-500 group-hover:scale-[1.025]',
          asset.type === 'image' ? 'h-auto' : 'h-full',
          fit === 'contain' ? 'object-contain' : 'object-cover',
        )}
        onError={() => {
          setState('failed');
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-[180px] w-full flex-col items-center justify-center bg-muted text-muted-foreground">
      {state === 'loading' ? (
        <Loader2 size={23} className="animate-spin text-primary" />
      ) : (
        <TypeIcon type={asset.type} />
      )}
      <span className="mt-2 text-xs font-semibold uppercase tracking-[0.15em]">
        {state === 'loading'
          ? '正在生成预览'
          : isUnrecoverable
            ? '原图已不可恢复'
            : state === 'failed'
              ? '预览不可用'
              : asset.type}
      </span>
    </div>
  );
};
