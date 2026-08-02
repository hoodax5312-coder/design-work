import { cn } from '../../lib/utils';
import { Button, Label } from '../ui';

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
        <Label className="text-sm font-medium text-foreground">
          {label}
        </Label>
      )}
      <div
        className={cn('rounded-lg bg-muted p-1', {
          'grid gap-1': true,
        })}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const isActive = value === option;
          return (
            <Button
              type="button"
              variant="ghost"
              key={option}
              onClick={() => onChange(option)}
              aria-pressed={isActive}
              className={cn('rounded font-medium', size === 'sm' ? 'h-7 py-1 text-xs' : 'h-9 py-1.5 text-sm', isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}
            >
              {renderOption ? renderOption(option, isActive) : option}
            </Button>
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
        <Label className="text-sm text-muted-foreground">{label}</Label>
      )}
      <div className="flex rounded-lg bg-muted p-1">
        {options.map((option) => {
          const isActive = value === option;
          return (
            <Button
              type="button"
              variant="ghost"
              key={option}
              onClick={() => onChange(option)}
              aria-pressed={isActive}
              className={cn('h-7 rounded px-3 py-1 text-xs font-medium', isActive ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}
            >
              {option}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
