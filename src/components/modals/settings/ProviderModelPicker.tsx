import { useState } from 'react';
import { Check, ChevronDown, Search, X } from '@/lib/remixIconShim';
import { cn } from '../../../lib/utils';
import type { ModelCategory, ProviderConfig, ProviderModelInfo } from '../../../types/provider';
import { Button } from '../../ui';

const formatContextLength = (value?: number) => {
  if (!value) return '';
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
};

interface ProviderModelPickerProps {
  /** 上游 /models 返回的完整列表，已按 ID 排好序。 */
  models: ProviderModelInfo[];
  provider: ProviderConfig;
  category: ModelCategory;
  categoryLabels: Record<ModelCategory, string>;
  onToggle: (ids: string[], included: boolean) => void;
  onClose: () => void;
}

/** 从上游模型列表中点选模型，加入或移出当前类型。 */
export function ProviderModelPicker({ models, provider, category, categoryLabels, onToggle, onClose }: ProviderModelPickerProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const label = categoryLabels[category];
  const categoriesById = new Map(provider.models.map((model) => [model.id, model.categories]));
  const isIncluded = (id: string) => Boolean(categoriesById.get(id)?.includes(category));
  const keyword = query.trim().toLowerCase();
  const visible = keyword
    ? models.filter((model) => model.id.toLowerCase().includes(keyword) || model.name?.toLowerCase().includes(keyword))
    : models;
  const includedCount = models.filter((model) => isIncluded(model.id)).length;
  const toAdd = visible.filter((model) => !isIncluded(model.id)).map((model) => model.id);
  const toRemove = visible.filter((model) => isIncluded(model.id)).map((model) => model.id);
  const scope = keyword ? `当前列出的 ${visible.length} 个模型` : `全部 ${models.length} 个模型`;

  return (
    <section aria-label="上游模型列表" className="mb-4 rounded-[var(--radius)] border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">
            模型列表
            <span className="ml-2 font-normal tabular-nums text-muted-foreground">共 {models.length} 个 · 已加入{label} {includedCount} 个</span>
          </p>
          {!collapsed && <p className="mt-1 text-[11px] text-muted-foreground">点选加入“{label}”；切换上方类型可把模型加入其他类型。</p>}
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={!toAdd.length} onClick={() => onToggle(toAdd, true)} title={`把${scope}加入${label}`} className="h-7 px-2">全选</Button>
        <Button type="button" variant="ghost" size="sm" disabled={!toRemove.length} onClick={() => onToggle(toRemove, false)} title={`把${scope}移出${label}`} className="h-7 px-2">全不选</Button>
        <Button type="button" variant="ghost" size="iconSm" onClick={onClose} aria-label="关闭模型列表" title="关闭模型列表" className="h-7 w-7"><X aria-hidden="true" size={14} /></Button>
      </div>

      {!collapsed && (
        <>
          <span className="relative mt-3 block">
            <Search aria-hidden="true" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索模型 ID 或名称"
              aria-label="搜索模型"
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </span>
          {visible.length ? (
            <div className="mt-3 flex max-h-[296px] flex-wrap gap-2 overflow-y-auto" role="group" aria-label={`加入${label}的模型`}>
              {visible.map((model) => {
                const included = isIncluded(model.id);
                const context = formatContextLength(model.contextLength);
                const others = (categoriesById.get(model.id) || [])
                  .filter((item) => item !== category)
                  .map((item) => categoryLabels[item]);
                const tooltip = [model.name, model.id, context && `上下文 ${context}`, others.length && `已在${others.join('、')}`]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <button
                    key={model.id}
                    type="button"
                    aria-pressed={included}
                    title={tooltip}
                    onClick={() => onToggle([model.id], !included)}
                    className={cn(
                      'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      included
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-card text-muted-foreground hover:border-ring hover:text-foreground',
                    )}
                  >
                    {included && <Check aria-hidden="true" size={13} className="shrink-0" />}
                    <span className="truncate">{model.name || model.id}</span>
                    {context && <span className={cn('shrink-0 rounded px-1 text-[10px] tabular-nums', included ? 'bg-background/20' : 'bg-muted')}>{context}</span>}
                    {others.length > 0 && <span className={cn('shrink-0 text-[10px]', included ? 'text-background/70' : 'text-muted-foreground')}>{others.join('·')}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 py-6 text-center text-xs text-muted-foreground">没有匹配“{query.trim()}”的模型</p>
          )}
        </>
      )}

      <div className="mt-2 flex justify-center">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className="flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? '展开列表' : '收起列表'}
          <ChevronDown aria-hidden="true" size={14} className={cn('transition-transform', !collapsed && 'rotate-180')} />
        </button>
      </div>
    </section>
  );
}
