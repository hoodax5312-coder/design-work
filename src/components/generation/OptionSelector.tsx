import { cn } from '../../lib/utils';

interface OptionSelectorProps<T extends string> {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  columns?: number;
  size?: 'sm' | 'md';
  renderOption?: (option: T, isActive: boolean) => React.ReactNode;
}

export function OptionSelector<T extends string>({
  options,
  value,
  onChange,
  label,
  columns = 3,
  size = 'md',
  renderOption,
}: OptionSelectorProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-[#1d2531] dark:text-slate-200">
          {label}
        </label>
      )}
      <div
        className={cn('bg-[#edf1f5] dark:bg-zinc-800 p-1 rounded-lg', {
          'grid gap-1': true,
        })}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const isActive = value === option;
          return (
            <button
              key={option}
              onClick={() => onChange(option)}
              className={cn(
                'rounded transition-all font-medium',
                size === 'sm' ? 'py-1 text-xs' : 'py-1.5 text-sm',
                isActive
                  ? 'bg-white dark:bg-zinc-700 text-[#1d2531] dark:text-white shadow-sm'
                  : 'text-[#1d2531] dark:text-slate-400 hover:bg-white/50 dark:hover:bg-zinc-700/50'
              )}
            >
              {renderOption ? renderOption(option, isActive) : option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Inline option selector for compact layouts
export function InlineOptionSelector<T extends string>({
  options,
  value,
  onChange,
  label,
}: Omit<OptionSelectorProps<T>, 'columns' | 'renderOption'>) {
  return (
    <div className="flex items-center justify-between">
      {label && (
        <label className="text-sm text-slate-600 dark:text-slate-400">{label}</label>
      )}
      <div className="flex bg-[#f7f9fa] dark:bg-zinc-800 p-1 rounded-lg">
        {options.map((option) => {
          const isActive = value === option;
          return (
            <button
              key={option}
              onClick={() => onChange(option)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-all',
                isActive
                  ? 'bg-white dark:bg-zinc-700 text-[#1d2531] dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
