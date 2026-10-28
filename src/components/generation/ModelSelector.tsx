import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/Select';
import { useId } from 'react';
import { Label } from '../ui/Label';

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
  const fieldId1 = useId();
  return (
    <div className="flex flex-col gap-2">
      <div className="w-full">
        <Label htmlFor={fieldId1} className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
        </Label>
        <Select value={value} onValueChange={(value) => onChange?.(value)}>
          <SelectTrigger id={fieldId1}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(options.length ? options : [{ value, label: value }])
              .filter((option) => option.value !== '')
              .map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
