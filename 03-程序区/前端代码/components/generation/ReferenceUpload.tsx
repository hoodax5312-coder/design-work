import { Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Label } from '../ui';

interface ReferenceUploadProps {
  label?: string;
  description?: string;
  onUpload?: (files: FileList) => void;
  accept?: string;
  className?: string;
}

export function ReferenceUpload({
  label = '参考素材',
  description = '或拖放文件到此处或 Ctrl+V 粘贴\n支持音频、视频、图片素材',
  onUpload,
  accept = 'image/*,video/*,audio/*',
  className,
}: ReferenceUploadProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length && onUpload) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length && onUpload) {
      onUpload(e.target.files);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <label
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          'flex h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-muted/35',
          'transition-colors hover:border-primary hover:bg-primary/5',
          className
        )}
      >
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleChange}
          multiple
        />
        <div className="mb-2 h-8 w-8 text-muted-foreground">
          <ImageIcon size={32} strokeWidth={1} />
        </div>
        <p className="whitespace-pre-line px-4 text-center text-xs text-muted-foreground">
          {description}
        </p>
      </label>
    </div>
  );
}
