import { type TextareaHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PromptInputProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  height?: number;
  actions?: ReactNode;
}

export function PromptInput({
  label = '提示词',
  height = 160,
  className,
  actions,
  ...props
}: PromptInputProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-[#1d2531] dark:text-slate-200">
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          className={cn(
            'w-full p-3 bg-white dark:bg-zinc-800 border border-[#551db0] dark:border-indigo-500 rounded-lg resize-none text-sm text-[#1d2531] dark:text-slate-200',
            'focus:outline-none focus:ring-1 focus:ring-[#551db0]',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            className
          )}
          style={{ height }}
          {...props}
        />
        {actions && (
          <div className="absolute bottom-2 left-2 flex gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}

interface PromptActionButtonProps {
  icon: React.ElementType;
  children: ReactNode;
  onClick?: () => void;
}

export function PromptActionButton({
  icon: Icon,
  children,
  onClick,
}: PromptActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 bg-[#f7f9fa] dark:bg-zinc-700 rounded text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-600 transition-colors"
    >
      <Icon size={12} />
      {children}
    </button>
  );
}
