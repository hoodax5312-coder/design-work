import { forwardRef, useEffect, useState, type HTMLAttributes } from 'react';
import { Minus, Plus } from '@/lib/remixIconShim';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import { Input } from './Input';

interface NumberFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  'aria-label'?: string;
  onValueChange: (value: number) => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));

// shadcn primitives composed into a numeric control; avoids browser-specific number spinners.
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField({ id, value, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, disabled, className, 'aria-label': ariaLabel, onValueChange, ...props }, ref) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (next: string) => {
    const parsed = Number(next);
    if (!Number.isFinite(parsed)) { setDraft(String(value)); return; }
    const normalized = clamp(parsed, min, max);
    setDraft(String(normalized));
    onValueChange(normalized);
  };
  const nudge = (delta: number) => commit(String(value + delta * step));
  return <div className={cn('flex h-10 overflow-hidden rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring', className)} {...props}>
    <Input ref={ref} id={id} type="text" inputMode="numeric" role="spinbutton" aria-label={ariaLabel} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ''))} onBlur={() => commit(draft)} onKeyDown={(event) => {
      if (event.key === 'Enter') { event.preventDefault(); commit(draft); }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); nudge(event.key === 'ArrowUp' ? 1 : -1); }
    }} className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0" />
    <div className="flex flex-col border-l border-input">
      <Button type="button" variant="ghost" size="iconSm" aria-label={`减少${ariaLabel || ''}`} disabled={disabled || value <= min} onClick={() => nudge(-1)} className="h-5 w-8 rounded-none text-muted-foreground hover:text-foreground"><Minus size={13} /></Button>
      <Button type="button" variant="ghost" size="iconSm" aria-label={`增加${ariaLabel || ''}`} disabled={disabled || value >= max} onClick={() => nudge(1)} className="h-5 w-8 rounded-none text-muted-foreground hover:text-foreground"><Plus size={13} /></Button>
    </div>
  </div>;
});
NumberField.displayName = 'NumberField';
