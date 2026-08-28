import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Eye, EyeOff, Trash2, Wifi } from '@/lib/remixIconShim';
import type { ModelCategory, ProviderConfig, ProviderModel } from '../../../types/provider';
import { Button, Input } from '../../ui';

const categoryLabels: Record<ModelCategory, string> = {
  language: '文本',
  image: '生图',
  video: '视频',
};

interface ProviderModelCardProps {
  provider: ProviderConfig;
  model: ProviderModel;
  category: ModelCategory;
  isDefault: boolean;
  testing: boolean;
  autoFocus?: boolean;
  onChange: (model: ProviderModel) => void;
  onRemove: () => void;
  onSetDefault: () => void;
  onTest: () => void;
}

const hasOverride = (model: ProviderModel, key: 'baseUrlOverride' | 'apiKeyOverride') =>
  Object.prototype.hasOwnProperty.call(model, key);

interface OverrideFieldProps {
  label: string;
  ariaLabel: string;
  value: string;
  defaultValue: string;
  inherited: boolean;
  placeholder: string;
  type?: 'text' | 'url' | 'password';
  showValue?: boolean;
  onShowValueChange?: () => void;
  onChange: (value: string) => void;
  onModeChange: (mode: 'default' | 'custom') => void;
}

function OverrideField({
  label,
  ariaLabel,
  value,
  defaultValue,
  inherited,
  placeholder,
  type = 'text',
  showValue = false,
  onShowValueChange,
  onChange,
  onModeChange,
}: OverrideFieldProps) {
  const isSecret = type === 'password';
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const sourceMenuRef = useRef<HTMLDivElement>(null);
  const inheritedValueLabel = isSecret
    ? defaultValue
      ? defaultValue.length > 8
        ? `${defaultValue.slice(0, 4)}${'•'.repeat(6)}${defaultValue.slice(-4)}`
        : '•'.repeat(defaultValue.length)
      : '未配置通用 Key'
    : defaultValue || '未配置通用 URL';

  useEffect(() => {
    if (!sourceMenuOpen) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!sourceMenuRef.current?.contains(event.target as Node)) setSourceMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSourceMenuOpen(false);
    };

    window.addEventListener('pointerdown', closeOnOutsidePress);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePress);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [sourceMenuOpen]);

  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2">
      <span className="text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <div ref={sourceMenuRef} className="relative">
        <Input
          type={isSecret && !showValue ? 'password' : type === 'password' ? 'text' : type}
          inputSize="sm"
          value={value}
          onFocus={(event) => {
            if (inherited) event.currentTarget.select();
          }}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={`${inherited ? 'pl-[68px]' : 'pl-3'} ${isSecret ? 'pr-[68px]' : 'pr-10'} text-xs`}
        />
        {inherited && (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            默认
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          onClick={() => setSourceMenuOpen((open) => !open)}
          aria-label={`${ariaLabel} 来源`}
          aria-haspopup="menu"
          aria-expanded={sourceMenuOpen}
          title="选择默认配置"
          className={`absolute top-0 h-8 w-8 rounded-md focus-visible:ring-inset focus-visible:ring-offset-0 ${isSecret ? 'right-8' : 'right-0'} ${sourceMenuOpen ? 'bg-muted' : ''}`}
        >
          <ChevronDown aria-hidden="true" size={14} className={`text-muted-foreground transition-transform ${sourceMenuOpen ? 'rotate-180' : ''}`} />
        </Button>
        {isSecret && onShowValueChange && (
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            onClick={onShowValueChange}
            aria-label={showValue ? '隐藏模型 API Key' : '显示模型 API Key'}
            title={showValue ? '隐藏模型 API Key' : '显示模型 API Key'}
            className="absolute right-0 top-0 h-8 w-8"
          >
            {showValue ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}
          </Button>
        )}
        {sourceMenuOpen && (
          <div
            role="menu"
            aria-label={`${ariaLabel} 默认配置`}
            className="absolute left-0 right-0 top-9 z-50 overflow-hidden rounded-lg border border-border bg-card p-2 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onModeChange('default');
                setSourceMenuOpen(false);
              }}
              className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="block text-sm text-foreground">使用全局 {isSecret ? 'KEY' : 'URL'}（不单独填写）</span>
              <span className="mt-3 flex min-w-0 items-center gap-3">
                <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">默认</span>
                <span className={`truncate text-sm text-muted-foreground ${isSecret ? 'font-mono' : ''}`}>{inheritedValueLabel}</span>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProviderModelCard({
  provider,
  model,
  category,
  isDefault,
  testing,
  autoFocus = false,
  onChange,
  onRemove,
  onSetDefault,
  onTest,
}: ProviderModelCardProps) {
  const [showKey, setShowKey] = useState(false);
  const modelIdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    modelIdRef.current?.focus();
    modelIdRef.current?.select();
  }, [autoFocus]);

  const update = (patch: Partial<ProviderModel>) => onChange({
    ...model,
    ...patch,
    verification: { status: 'pending' },
  });

  const setOverrideMode = (
    key: 'baseUrlOverride' | 'apiKeyOverride',
    mode: string,
  ) => {
    if (mode === 'custom') {
      update({ [key]: '' });
      return;
    }
    const next = { ...model };
    delete next[key];
    onChange({ ...next, verification: { status: 'pending' } });
  };

  return (
    <article className="rounded-[var(--radius)] border border-border bg-card p-4" aria-label={`${model.id} 模型配置`}>
      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2">
        <span className="text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Model ID</span>
        <Input
          ref={modelIdRef}
          inputSize="sm"
          value={model.id}
          onChange={(event) => update({ id: event.target.value })}
          aria-label="模型 ID"
          className="min-w-0 font-mono text-xs font-semibold"
        />
      </div>

      <div className="mt-4 grid gap-3">
        <OverrideField
          label="API Key"
          ariaLabel={`${model.id} API Key`}
          value={hasOverride(model, 'apiKeyOverride') ? model.apiKeyOverride || '' : provider.apiKey}
          defaultValue={provider.apiKey}
          inherited={!hasOverride(model, 'apiKeyOverride')}
          placeholder={provider.apiKey ? '输入当前模型的 API Key' : '未配置通用 Key'}
          type="password"
          showValue={showKey}
          onShowValueChange={() => setShowKey((visible) => !visible)}
          onChange={(value) => update({ apiKeyOverride: value })}
          onModeChange={(mode) => setOverrideMode('apiKeyOverride', mode)}
        />

        <OverrideField
          label="Base URL"
          ariaLabel={`${model.id} Base URL`}
          value={hasOverride(model, 'baseUrlOverride') ? model.baseUrlOverride || '' : provider.baseUrl}
          defaultValue={provider.baseUrl}
          inherited={!hasOverride(model, 'baseUrlOverride')}
          placeholder="https://api.example.com/v1"
          type="url"
          onChange={(value) => update({ baseUrlOverride: value })}
          onModeChange={(mode) => setOverrideMode('baseUrlOverride', mode)}
        />
      </div>

      {model.verification?.error && <p role="alert" className="mt-3 text-xs leading-5 text-red-600 dark:text-red-300">{model.verification.error}</p>}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSetDefault}
          className={`h-8 px-2 text-xs ${isDefault ? 'text-muted-foreground hover:bg-transparent hover:text-muted-foreground' : ''}`}
          aria-pressed={isDefault}
        >
          {isDefault && <Check aria-hidden="true" size={12} />}{isDefault ? '默认' : '设为默认'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onTest} loading={testing} className="h-8 text-xs">
          {!testing && <Wifi aria-hidden="true" size={13} />} {testing ? '正在测试' : '测试连接'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`从${categoryLabels[category]}移除 ${model.id}`}
          title={`从${categoryLabels[category]}移除`}
          className="h-8 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 aria-hidden="true" size={13} /> 删除模型
        </Button>
      </div>
    </article>
  );
}
