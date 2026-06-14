import { Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

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
      <label className="text-sm font-medium text-[#1d2531] dark:text-slate-200">
        {label}
      </label>
      <label
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          'flex flex-col items-center justify-center h-32 bg-[#f7f9fa] dark:bg-zinc-800/50 border border-[#e1e7ed] dark:border-zinc-700 rounded-lg cursor-pointer',
          'hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors',
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
        <div className="w-8 h-8 mb-2 text-slate-400">
          <ImageIcon size={32} strokeWidth={1} />
        </div>
        <p className="text-xs text-[#657083] dark:text-slate-400 text-center px-4 whitespace-pre-line">
          {description}
        </p>
      </label>
    </div>
  );
}
