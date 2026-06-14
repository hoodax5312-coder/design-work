import { Square, Smartphone, Monitor, LayoutTemplate } from 'lucide-react';
import { cn } from '../../lib/utils';

export type AspectRatio = '自适应' | '1:1' | '9:16' | '16:9' | '2:3' | '3:2' | '3:4' | '4:3' | '21:9';

interface RatioSelectorProps {
  value: string;
  onChange: (ratio: string) => void;
  options?: string[];
  label?: string;
  columns?: number;
  variant?: 'default' | 'compact';
}

export function RatioIcon({ ratio, size = 14 }: { ratio: string; size?: number }) {
  switch (ratio) {
    case '1:1':
      return <Square size={size} />;
    case '9:16':
      return <Smartphone size={size} />;
    case '16:9':
      return <Monitor size={size} />;
    case '2:3':
    case '3:4':
      return (
        <div
          className="border-2 border-current rounded-sm"
          style={{ width: size * 0.75, height: size }}
        />
      );
    case '3:2':
    case '4:3':
      return (
        <div
          className="border-2 border-current rounded-sm"
          style={{ width: size, height: size * 0.75 }}
        />
      );
    case '21:9':
      return (
        <div
          className="border-2 border-current rounded-sm"
          style={{ width: size * 1.25, height: size * 0.5 }}
        />
      );
    default:
      return <LayoutTemplate size={size} />;
  }
}

export function RatioSelector({
  value,
  onChange,
  options = ['自适应', '1:1', '9:16', '16:9', '2:3', '3:2', '3:4', '21:9'],
  label = '比例',
  columns = 4,
  variant = 'default',
}: RatioSelectorProps) {
  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-600 dark:text-slate-400">{label}</label>
          <span className="text-xs text-slate-400">{value}</span>
        </div>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {options.map((r) => (
            <button
              key={r}
              onClick={() => onChange(r)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 rounded-lg border transition-all',
                value === r
                  ? 'border-[#551db0] bg-indigo-50/50 dark:bg-indigo-500/10 text-[#551db0] dark:text-indigo-400'
                  : 'border-transparent bg-[#f7f9fa] dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700'
              )}
            >
              <RatioIcon ratio={r} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-[#1d2531] dark:text-slate-200">
        {label}
      </label>
      <div className="bg-[#edf1f5] dark:bg-zinc-800 p-1 rounded-lg">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {options.map((r) => (
            <button
              key={r}
              onClick={() => onChange(r)}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 px-1 rounded transition-all',
                value === r
                  ? 'bg-white dark:bg-zinc-700 text-[#1d2531] dark:text-white shadow-sm'
                  : 'text-[#1d2531] dark:text-slate-400 hover:bg-white/50 dark:hover:bg-zinc-700/50'
              )}
            >
              <RatioIcon ratio={r} />
              <span className="text-xs scale-90 origin-left whitespace-nowrap">{r}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
