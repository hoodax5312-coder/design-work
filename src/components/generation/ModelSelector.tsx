import { ChevronDown } from 'lucide-react';

interface ModelSelectorProps {
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  options?: { value: string; label: string }[];
}

export function ModelSelector({
  label = '选择生成模型',
  value,
  onChange,
  options = [],
}: ModelSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[#1d2531] dark:text-slate-200">
        {label}
      </label>
      <button
        onClick={() => {
          // In a real app, this would open a dropdown
          if (options.length > 0 && onChange) {
            const currentIndex = options.findIndex((o) => o.value === value);
            const nextIndex = (currentIndex + 1) % options.length;
            onChange(options[nextIndex].value);
          }
        }}
        className="flex items-center justify-between w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-[#e1e7ed] dark:border-zinc-700 rounded-lg text-sm text-[#1d2531] dark:text-slate-200 hover:border-slate-300 dark:hover:border-zinc-600 transition-colors"
      >
        <span>{options.find((o) => o.value === value)?.label || value}</span>
        <div className="bg-[#f7f9fa] dark:bg-zinc-700 p-1 rounded">
          <ChevronDown size={14} className="text-slate-500" />
        </div>
      </button>
    </div>
  );
}
