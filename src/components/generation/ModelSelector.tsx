import { Select } from '../ui';

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
      <Select label={label} value={value} onChange={(event) => onChange?.(event.target.value)} options={options.length ? options : [{ value, label: value }]} />
    </div>
  );
}
