import { useRef, useState } from 'react';
import { FolderInput, ImagePlus, Loader2, ShieldCheck, Upload, X } from '@/lib/remixIconShim';
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui';

const supportedImage = (file: File) =>
  file.type.startsWith('image/') || /\.(avif|gif|heic|jpe?g|png|webp)$/i.test(file.name);

export const AssetImportDialog = ({
  onClose,
  onDropImages,
  onChooseFolder,
}: {
  onClose: () => void;
  onDropImages: (files: File[]) => Promise<void>;
  onChooseFolder: () => Promise<void>;
}) => {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importImages = async (files: File[]) => {
    const images = files.filter(supportedImage);
    if (!images.length) {
      setMessage('请选择 PNG、JPG、WebP、GIF、AVIF 或 HEIC 图片。');
      return;
    }
    setBusy(true);
    setMessage(`正在将 ${images.length} 张图片存入本地素材库…`);
    try {
      await onDropImages(images);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '图片入库失败，请重试。');
    } finally {
      setBusy(false);
    }
  };

  const chooseFolder = async () => {
    setBusy(true);
    try {
      await onChooseFolder();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '打开文件夹选择器失败。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && !busy && onClose()}>
      <SheetContent
        side="right"
        showOverlay={false}
        showCloseButton={false}
        aria-busy={busy}
        className="flex w-[min(420px,calc(100vw-24px))] max-w-none flex-col border-border bg-background p-0"
      >
        <SheetHeader className="flex-row items-start justify-between border-b border-border px-5 py-5">
          <div>
            <SheetTitle id="asset-import-title" className="text-xl tracking-tight">导入图片素材</SheetTitle>
            <SheetDescription id="asset-import-description" className="mt-1.5 text-xs leading-5">
              拖入图片即可自动存入栗作管理目录，并完成去重与预览准备。
            </SheetDescription>
          </div>
          <Button type="button" variant="ghost" size="iconSm" onClick={onClose} disabled={busy} aria-label="关闭导入素材面板">
            <X size={17} aria-hidden="true" />
          </Button>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!busy) void importImages([...event.dataTransfer.files]);
            }}
            className={`relative flex min-h-[330px] flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed px-6 text-center transition-all ${
              dragging
                ? 'border-primary bg-primary/10 ring-2 ring-primary/15'
                : 'border-border bg-muted/45 hover:border-foreground/25'
            }`}
          >
            <span className="relative grid h-16 w-16 place-items-center rounded-lg bg-foreground text-background shadow-sm">
              {busy ? <Loader2 size={28} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={28} aria-hidden="true" />}
            </span>
            <div className="relative mt-5 text-base font-semibold tracking-tight">
              {dragging ? '松开即可自动入库' : '把图片拖到这里'}
            </div>
            <p className="relative mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
              支持 PNG、JPG、WebP、GIF、AVIF 和 HEIC，单张最大 100 MB。
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="relative mt-5"
            >
              <Upload size={15} aria-hidden="true" /> 从电脑选择图片
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/heic"
              multiple
              className="sr-only"
              onChange={(event) => {
                const files = [...(event.target.files || [])];
                event.target.value = '';
                void importImages(files);
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5 text-xs leading-4 text-muted-foreground">
              <ShieldCheck size={15} className="shrink-0 text-foreground" aria-hidden="true" />
              拖入图片会保存到栗作本地管理目录；不会上传到第三方服务。
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void chooseFolder()}
              disabled={busy}
              className="h-8 shrink-0 text-xs"
            >
              <FolderInput size={13} aria-hidden="true" /> 选择文件夹
            </Button>
          </div>

          <div role="status" aria-live="polite" className="mt-3 min-h-5 text-center text-xs text-muted-foreground">
            {message}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
