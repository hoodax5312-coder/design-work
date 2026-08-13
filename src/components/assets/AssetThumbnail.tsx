import { useEffect, useState } from 'react';
import { AudioLines, File, FileText, Film, Image as ImageIcon, Loader2, Presentation } from 'lucide-react';
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
  fit = 'cover',
}: {
  asset: AssetSummary;
  onReady?: () => void;
  fit?: 'cover' | 'contain';
}) => {
  const generatedUrl = typeof asset.userMetadata?.generatedUrl === 'string'
    ? asset.userMetadata.generatedUrl
    : '';
  const [state, setState] = useState<'missing' | 'loading' | 'ready' | 'failed'>(
    generatedUrl || asset.previewStatus === 'ready' ? 'ready' : 'missing',
  );
  const [version, setVersion] = useState(asset.updatedAt);

  useEffect(() => {
    if (asset.type !== 'image' || state !== 'missing') return;
    const controller = new AbortController();
    setState('loading');
    assetService
      .requestPreview(asset.id)
      .then(({ id }) => waitForTask(id, undefined, controller.signal))
      .then((task) => {
        if (task.status === 'completed') {
          setVersion(Date.now());
          setState('ready');
          onReady?.();
        } else {
          setState('failed');
        }
      })
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') setState('failed');
      });
    return () => controller.abort();
  }, [asset.id, asset.type, onReady, state]);

  if (state === 'ready' && asset.type === 'image') {
    return (
      <img
        src={generatedUrl || asset.previewUrl || `/api/assets/${asset.id}/preview?size=512&v=${version}`}
        alt=""
        loading="lazy"
        className={cn(
          'h-full w-full transition-transform duration-500 group-hover:scale-[1.025]',
          fit === 'contain' ? 'object-contain' : 'object-cover',
        )}
        onError={() => setState('failed')}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(200,239,57,0.14),transparent_36%),linear-gradient(145deg,#f2f1ec,#e8e7e1)] text-slate-400 dark:bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.055),transparent_38%),linear-gradient(145deg,#222,#151515)] dark:text-zinc-600">
      {state === 'loading' ? (
        <Loader2 size={23} className="animate-spin text-[#c8ff00]" />
      ) : (
        <TypeIcon type={asset.type} />
      )}
      <span className="mt-2 text-xs font-semibold uppercase tracking-[0.15em]">
        {state === 'loading' ? '正在生成预览' : state === 'failed' ? '预览不可用' : asset.type}
      </span>
    </div>
  );
};
