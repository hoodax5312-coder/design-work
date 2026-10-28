import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, X } from '../../lib/remixIconShim';
import { referenceImageUrl, saveReferenceImage, type CanvasReferenceImage } from './referenceImage';

export const CanvasReferenceImageInput = ({ image, disabled, onChange }: {
  image?: CanvasReferenceImage;
  disabled: boolean;
  onChange: (image: CanvasReferenceImage | undefined) => void;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const previewUrl = image ? referenceImageUrl(image) : '';
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    setPreviewReady(false);
    if (!previewUrl) return;
    const controller = new AbortController();
    const check = async () => {
      for (let attempt = 0; attempt < 20 && !controller.signal.aborted; attempt += 1) {
        const response = await fetch(previewUrl, { method: 'HEAD', signal: controller.signal }).catch(() => null);
        if (controller.signal.aborted) return;
        if (response?.ok) { setPreviewReady(true); return; }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    };
    void check();
    return () => controller.abort();
  }, [previewUrl]);

  const upload = async (file: File) => {
    if (busy.current || disabled) return;
    busy.current = true;
    setUploading(true);
    setError('');
    try {
      const saved = await saveReferenceImage(file);
      if (mounted.current) onChange(saved);
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '参考图上传失败');
    } finally {
      busy.current = false;
      if (mounted.current) setUploading(false);
    }
  };

  return (
    <div className="shrink-0">
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label="选择参考图文件" className="hidden" disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void upload(file);
        }} />
      <div className="relative h-12 w-12">
        <button type="button" aria-label={image ? '更换参考图' : '添加参考图'} disabled={disabled || uploading}
          onClick={() => input.current?.click()} aria-busy={uploading} title={uploading ? '上传中…' : image?.name || 'PNG / JPEG / WebP，最大 10 MB'}
          className="flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
          {image && previewReady && !uploading
            ? <img src={referenceImageUrl(image)} alt={image.name} className="h-full w-full object-cover" />
            : uploading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
        </button>
        {image && !uploading && <button type="button" aria-label="移除参考图" disabled={disabled}
          onClick={() => { setError(''); onChange(undefined); }} title="仅解除引用，不删除资产库原图"
          className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-card text-muted-foreground shadow-sm hover:text-foreground disabled:opacity-50"><X size={14} /></button>}
      </div>
      {error && <p role="alert" className="mt-1 max-w-[180px] text-xs text-destructive">{error}</p>}
    </div>
  );
};
