import { Square, Smartphone, Monitor, LayoutTemplate } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button, Label } from '../ui';

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
          <Label className="text-sm text-muted-foreground">{label}</Label>
          <span className="text-xs text-muted-foreground">{value}</span>
        </div>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {options.map((r) => (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              key={r}
              onClick={() => onChange(r)}
              aria-pressed={value === r}
              className={cn('h-auto flex-col gap-1 py-2', value === r && 'border-primary bg-primary/10')}
            >
              <RatioIcon ratio={r} />
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div className="rounded-lg bg-muted p-1">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {options.map((r) => (
            <Button
              type="button"
              variant="ghost"
              key={r}
              onClick={() => onChange(r)}
              aria-pressed={value === r}
              className={cn('h-auto rounded px-1 py-2 text-foreground', value === r && 'bg-background shadow-sm')}
            >
              <RatioIcon ratio={r} />
              <span className="text-xs scale-90 origin-left whitespace-nowrap">{r}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
