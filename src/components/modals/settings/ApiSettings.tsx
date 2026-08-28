import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Eye, EyeOff, Pencil, Plus, Power, Server, Trash2, Wifi } from '@/lib/remixIconShim';
import {
  getConfiguredModels,
  getSelectedModel,
  invalidateProviderModels,
  markModelsPending,
  migrateProviderStateV6,
} from '../../../lib/providerConnections';
import { normalizeProviderBaseUrl } from '../../../lib/providerConfig';
import { cn } from '../../../lib/utils';
import { testProviderModel } from '../../../services/providerService';
import {
  providerDefaults,
  useProviderStore,
  type ModelCategory,
  type ProviderConfig,
  type ProviderModel,
  type ProviderProtocol,
} from '../../../stores/useProviderStore';
import { Badge, Button, Card, Input, Select } from '../../ui';
import { ProviderModelCard } from './ProviderModelCard';

const categories: Array<{ id: ModelCategory; label: string }> = [
  { id: 'language', label: '文本' },
  { id: 'image', label: '生图' },
  { id: 'video', label: '视频' },
];

const statusLabels = {
  pending: '待重新验证',
  healthy: '已验证',
  unhealthy: '连接异常',
  unverified: '未验证',
} as const;

const makeProvider = (): ProviderConfig => ({
  id: crypto.randomUUID(),
  name: '',
  protocol: 'responses',
  baseUrl: providerDefaults.responses.baseUrl,
  apiKey: '',
  models: [],
  selectedModels: {},
});

const providerHost = (baseUrl: string) => {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl || '未填写 Host';
  }
};

const isProviderSaved = (provider: ProviderConfig | undefined) => Boolean(
  provider?.savedAt || provider?.apiKey.trim() || provider?.models.length,
);

const isUnsupportedModelListError = (message: string) =>
  /模型列表|models|not found|unsupported|\b404\b|\b405\b/i.test(message);

const hasOverride = (model: ProviderModel, key: 'baseUrlOverride' | 'apiKeyOverride') =>
  Object.prototype.hasOwnProperty.call(model, key);

const normalizeProvider = (provider: ProviderConfig): ProviderConfig => ({
  ...provider,
  name: provider.name.trim(),
  baseUrl: normalizeProviderBaseUrl(provider.protocol, provider.baseUrl),
  apiKey: provider.apiKey.trim(),
  models: provider.models.map((model) => ({
    ...model,
    id: model.id.trim(),
    ...(hasOverride(model, 'baseUrlOverride')
      ? { baseUrlOverride: normalizeProviderBaseUrl(provider.protocol, model.baseUrlOverride || '') }
      : {}),
    ...(hasOverride(model, 'apiKeyOverride')
      ? { apiKeyOverride: model.apiKeyOverride?.trim() || '' }
      : {}),
  })),
  savedAt: Date.now(),
});

const validateProvider = (provider: ProviderConfig) => {
  if (!provider.name.trim()) return '请填写厂商名称';
  if (!provider.baseUrl.trim()) return '请填写通用 Base URL';
  if (!provider.apiKey.trim()) return '请填写通用 API Key';
  if (!provider.models.length) return '请至少添加一个模型';
  const seen = new Set<string>();
  for (const model of provider.models) {
    if (!model.id.trim()) return '模型 ID 不能为空';
    if (seen.has(model.id.trim())) return `模型 ID “${model.id.trim()}”重复`;
    seen.add(model.id.trim());
    if (!model.categories.length) return `模型 ${model.id} 尚未指定能力类型`;
    if (hasOverride(model, 'baseUrlOverride') && !model.baseUrlOverride?.trim()) {
      return `模型 ${model.id} 已选择自定义 URL，请填写完整`;
    }
    if (hasOverride(model, 'apiKeyOverride') && !model.apiKeyOverride?.trim()) {
      return `模型 ${model.id} 已选择自定义 Key，请填写完整`;
    }
  }
  return '';
};

interface ApiSettingsProps {
  onEditingChange?: (editing: boolean) => void;
}

export function ApiSettings({ onEditingChange }: ApiSettingsProps) {
  const {
    providers,
    activeProviderIds,
    upsertProvider,
    replaceProviders,
    setActiveProvider,
    removeProvider,
  } = useProviderStore();
  const importInputRef = useRef<HTMLInputElement>(null);
  const headerActionsTarget =
    typeof document === 'undefined' ? null : document.getElementById('settings-header-actions');
  const initialProvider = providers.find(isProviderSaved) || providers[0];
  const [draft, setDraft] = useState<ProviderConfig | null>(() =>
    isProviderSaved(initialProvider) ? null : initialProvider || makeProvider());
  const [testingTarget, setTestingTarget] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedProviderIds, setExpandedProviderIds] = useState<Set<string>>(() => new Set());
  const savedProviders = providers.filter(isProviderSaved);
  const editing = Boolean(draft);

  useEffect(() => {
    onEditingChange?.(editing);
    return () => onEditingChange?.(false);
  }, [editing, onEditingChange]);

  const beginEdit = (provider: ProviderConfig) => {
    setDraft({
      ...provider,
      models: provider.models.map((model) => ({ ...model, categories: [...model.categories] })),
      selectedModels: { ...provider.selectedModels },
    });
    setMessage(null);
  };

  const saveProvider = () => {
    if (!draft) return;
    const error = validateProvider(draft);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    const provider = normalizeProvider(draft);
    upsertProvider(provider);
    if (!savedProviders.length) {
      categories.forEach(({ id }) => {
        if (getConfiguredModels(provider, id).length) setActiveProvider(id, provider.id);
      });
    }
    setDraft(null);
    setMessage({ type: 'success', text: `${provider.name} 已保存，模型默认继承通用连接` });
  };

  const testCommonConnection = async (provider: ProviderConfig, activeCategory: ModelCategory) => {
    const model = getConfiguredModels(provider, activeCategory)[0] || provider.models[0];
    const category = model?.categories[0];
    if (!model || !category) {
      setMessage({ type: 'error', text: '请先添加一个模型再测试通用连接' });
      return;
    }
    if (!provider.baseUrl.trim() || !provider.apiKey.trim()) {
      setMessage({ type: 'error', text: '请先填写通用 Base URL 和 API Key' });
      return;
    }
    const commonModel = { ...model };
    delete commonModel.baseUrlOverride;
    delete commonModel.apiKeyOverride;
    const testProvider = {
      ...provider,
      models: provider.models.map((item) => item.id === model.id ? commonModel : item),
    };
    setTestingTarget('common');
    setMessage(null);
    try {
      const result = await testProviderModel(testProvider, category, model.id);
      setMessage({ type: 'success', text: `通用连接验证通过，发现 ${result.models.length} 个模型，未发起生成` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '连接失败' });
    } finally {
      setTestingTarget('');
    }
  };

  const testModel = async (provider: ProviderConfig, category: ModelCategory, modelId: string) => {
    const model = provider.models.find((item) => item.id === modelId);
    if (!model) return;
    if ((hasOverride(model, 'baseUrlOverride') && !model.baseUrlOverride?.trim())
      || (hasOverride(model, 'apiKeyOverride') && !model.apiKeyOverride?.trim())) {
      setMessage({ type: 'error', text: `请先完整填写模型 ${modelId} 的自定义连接` });
      return;
    }
    setTestingTarget(modelId);
    setMessage(null);
    const startedAt = Date.now();
    try {
      const result = await testProviderModel(provider, category, modelId);
      setDraft({
        ...provider,
        models: provider.models.map((item) => item.id === modelId
          ? { ...item, verification: { status: 'healthy', checkedAt: Date.now(), latency: result.latency } }
          : item),
      });
      setMessage({ type: 'success', text: `${modelId} 验证通过，发现 ${result.models.length} 个模型` });
    } catch (error) {
      const text = error instanceof Error ? error.message : '连接失败';
      const unsupported = isUnsupportedModelListError(text);
      setDraft({
        ...provider,
        models: provider.models.map((item) => item.id === modelId
          ? {
              ...item,
              verification: {
                status: unsupported ? 'unverified' : 'unhealthy',
                checkedAt: Date.now(),
                latency: Date.now() - startedAt,
                error: unsupported ? '上游不支持模型列表验证，已保留手动配置' : text,
              },
            }
          : item),
      });
      setMessage({ type: unsupported ? 'success' : 'error', text: unsupported ? '上游不支持模型列表验证，已标记为“未验证”' : text });
    } finally {
      setTestingTarget('');
    }
  };

  const activateProvider = (provider: ProviderConfig, category: ModelCategory) => {
    const selected = provider.models.find((model) => model.id === getSelectedModel(provider, category));
    const status = selected?.verification?.status || 'pending';
    if (status !== 'healthy') {
      const label = categories.find((item) => item.id === category)?.label;
      const confirmed = window.confirm(
        `${provider.name} 的${label}默认模型当前为“${statusLabels[status]}”。\nHost：${providerHost(selected?.baseUrlOverride || provider.baseUrl)}\n\n仍要启用并允许实际请求继续吗？`,
      );
      if (!confirmed) return;
    }
    setActiveProvider(category, provider.id);
    setMessage({ type: 'success', text: `${provider.name} 已设为当前${categories.find((item) => item.id === category)?.label}厂商` });
  };

  const exportProviders = () => {
    const payload = {
      format: 'design-work-provider-config',
      version: 3,
      exportedAt: new Date().toISOString(),
      activeProviderIds,
      providers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `design-work-providers-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: 'API 配置已导出（包含 API Key，请妥善保管）' });
  };

  const importProviders = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { providers?: unknown }).providers)) {
        throw new Error('文件格式不正确，应为栗作 API 配置 JSON');
      }
      const migrated = migrateProviderStateV6(parsed);
      if (!migrated.providers.length) throw new Error('文件中没有可导入的 API 配置');
      const imported = migrated.providers.map(markModelsPending);
      const importedIds = new Set(imported.map((provider) => provider.id));
      replaceProviders({
        providers: [...providers.filter((provider) => !importedIds.has(provider.id)), ...imported],
        activeProviderIds: { ...activeProviderIds, ...migrated.activeProviderIds },
      });
      setMessage({ type: 'success', text: `已导入 ${imported.length} 个厂商，所有模型均待重新验证` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '导入失败' });
    }
  };

  const toggleProvider = (providerId: string) => setExpandedProviderIds((current) => {
    const next = new Set(current);
    if (next.has(providerId)) next.delete(providerId);
    else next.add(providerId);
    return next;
  });

  return (
    <>
      {!draft && headerActionsTarget && createPortal(
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <input ref={importInputRef} type="file" accept="application/json,.json" onChange={(event) => void importProviders(event)} className="sr-only" />
            <Button type="button" onClick={() => importInputRef.current?.click()} variant="ghost" size="sm" className="h-8">导入数据</Button>
            <Button type="button" onClick={exportProviders} variant="ghost" size="sm" disabled={!providers.length} className="h-8">导出数据</Button>
            <Button type="button" onClick={() => { setDraft(makeProvider()); setMessage(null); }} variant="ghost" size="sm" className="h-8 gap-1.5"><Plus aria-hidden="true" size={15} /> 添加厂商</Button>
          </div>,
          headerActionsTarget,
        )}

      <div className="space-y-5">
        {draft ? (
          <ProviderEditor
            draft={draft}
            setDraft={setDraft}
            testingTarget={testingTarget}
            message={message}
            onTestCommon={(category) => void testCommonConnection(draft, category)}
            onTestModel={(category, modelId) => void testModel(draft, category, modelId)}
            onSave={saveProvider}
            onCancel={() => { setDraft(null); setMessage(null); }}
          />
        ) : savedProviders.length ? (
        <div className="flex flex-col gap-4">
          {savedProviders.map((provider) => {
            const expanded = expandedProviderIds.has(provider.id);
            return (
              <Card key={provider.id} padding="none" className="overflow-hidden border-border">
                <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted"><Server aria-hidden="true" size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <h5 className="truncate text-sm font-semibold">{provider.name}</h5>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{providerHost(provider.baseUrl)} · {provider.models.length} 个模型</p>
                  </div>
                  <Button type="button" variant="ghost" size="iconSm" onClick={() => beginEdit(provider)} aria-label={`编辑 ${provider.name}`} title={`编辑 ${provider.name}`} className="h-8 w-8"><Pencil aria-hidden="true" size={13} /></Button>
                  <Button type="button" variant="ghost" size="iconSm" onClick={() => { if (window.confirm(`确定删除 API 厂商“${provider.name}”吗？`)) removeProvider(provider.id); }} aria-label={`删除 ${provider.name}`} title={`删除 ${provider.name}`} className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 aria-hidden="true" size={14} /></Button>
                  <Button type="button" variant="ghost" size="iconSm" onClick={() => toggleProvider(provider.id)} aria-label={expanded ? '收起模型类型' : '展开模型类型'} aria-expanded={expanded} className="h-8 w-8"><ChevronDown aria-hidden="true" size={15} className={cn('transition-transform', expanded && 'rotate-180')} /></Button>
                </div>
                {expanded && (
                  <div className="border-t border-border px-4 py-3 sm:px-5">
                    {categories.map(({ id, label }) => {
                      const models = getConfiguredModels(provider, id);
                      const active = activeProviderIds[id] === provider.id;
                      return (
                        <div key={id} className="flex min-h-11 items-center gap-3 border-b border-border py-2 last:border-0">
                          <span className="w-10 shrink-0 text-xs font-semibold">{label}</span>
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{models.length ? `${models.length} 个模型 · ${getSelectedModel(provider, id)}` : '未配置'}</span>
                          {models.length > 0 && (active
                            ? <Badge variant="secondary" className="text-xs">当前使用</Badge>
                            : <Button type="button" variant="ghost" size="sm" onClick={() => activateProvider(provider, id)} className="h-7 px-2 text-xs"><Power aria-hidden="true" size={12} /> 启用</Button>)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card variant="ghost" className="flex min-h-56 flex-col items-center justify-center border-dashed text-center">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-muted"><Server aria-hidden="true" size={19} /></span>
          <p className="mt-4 text-sm font-semibold">尚未添加 API 厂商</p>
          <p className="mt-1 text-xs text-muted-foreground">先配置通用连接，再按模型覆盖特殊 URL 或 Key。</p>
          <Button type="button" onClick={() => setDraft(makeProvider())} variant="ghost" size="sm" className="mt-4 h-8 gap-1.5"><Plus aria-hidden="true" size={15} /> 添加厂商</Button>
        </Card>
        )}

        {!draft && message && <p role="status" className={message.type === 'success' ? 'text-xs text-muted-foreground' : 'text-xs text-red-600'}>{message.text}</p>}
      </div>
    </>
  );
}

interface ProviderEditorProps {
  draft: ProviderConfig;
  setDraft: (provider: ProviderConfig) => void;
  testingTarget: string;
  message: { type: 'success' | 'error'; text: string } | null;
  onTestCommon: (category: ModelCategory) => void;
  onTestModel: (category: ModelCategory, modelId: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function ProviderEditor({ draft, setDraft, testingTarget, message, onTestCommon, onTestModel, onSave, onCancel }: ProviderEditorProps) {
  const [activeCategory, setActiveCategory] = useState<ModelCategory>('language');
  const [newModelId, setNewModelId] = useState('');
  const [showKey, setShowKey] = useState(false);
  const models = getConfiguredModels(draft, activeCategory);

  const changeProtocol = (protocol: ProviderProtocol) => {
    const previousDefault = providerDefaults[draft.protocol].baseUrl;
    const invalidated = invalidateProviderModels(draft, 'protocol');
    setDraft({
      ...invalidated,
      protocol,
      baseUrl: !draft.baseUrl || draft.baseUrl === previousDefault
        ? providerDefaults[protocol].baseUrl
        : draft.baseUrl,
    });
  };

  const changeDefault = (field: 'baseUrl' | 'apiKey', value: string) => {
    const invalidated = invalidateProviderModels(draft, field);
    setDraft({ ...invalidated, [field]: value });
  };

  const addModel = () => {
    const usedIds = new Set(draft.models.map((model) => model.id));
    let index = 1;
    let id = 'new-model';
    while (usedIds.has(id)) {
      index += 1;
      id = `new-model-${index}`;
    }
    setDraft({
      ...draft,
      models: [...draft.models, { id, categories: [activeCategory], verification: { status: 'pending' as const } }],
      selectedModels: draft.selectedModels[activeCategory]
        ? draft.selectedModels
        : { ...draft.selectedModels, [activeCategory]: id },
    });
    setNewModelId(id);
  };

  const changeModel = (oldId: string, next: ProviderModel) => {
    const selectedModels = Object.fromEntries(Object.entries(draft.selectedModels).map(([category, selected]) => [
      category,
      selected === oldId ? next.id : selected,
    ]));
    setDraft({
      ...draft,
      models: draft.models.map((model) => model.id === oldId ? next : model),
      selectedModels,
    });
  };

  const removeFromCategory = (model: ProviderModel) => {
    const remainingCategories = model.categories.filter((category) => category !== activeCategory);
    const nextModels = remainingCategories.length
      ? draft.models.map((item) => item.id === model.id ? { ...item, categories: remainingCategories } : item)
      : draft.models.filter((item) => item.id !== model.id);
    const nextDefault = nextModels.find((item) => item.categories.includes(activeCategory))?.id;
    setDraft({
      ...draft,
      models: nextModels,
      selectedModels: {
        ...draft.selectedModels,
        [activeCategory]: draft.selectedModels[activeCategory] === model.id
          ? nextDefault
          : draft.selectedModels[activeCategory],
      },
    });
  };

  return (
    <div aria-label="API 厂商编辑表单">
      <header className="sticky -top-px z-30 mb-5 flex min-h-[72px] items-center justify-between gap-4 border-b border-border bg-card/95 py-4 backdrop-blur-xl">
        <div className="min-w-0">
          <h5 className="text-sm font-semibold">{draft.savedAt ? `编辑 ${draft.name}` : '添加 API 厂商'}</h5>
          <p className="mt-1 truncate text-xs text-muted-foreground">模型默认继承通用连接，也可以单独覆盖 URL 和 Key。</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>取消</Button>
          <Button type="button" variant="primary" size="sm" onClick={onSave} className="bg-foreground text-background hover:bg-foreground/85"><Check aria-hidden="true" size={14} /> 保存厂商</Button>
        </div>
      </header>

      <section className="space-y-4 rounded-[var(--radius)] bg-muted/45 p-4" aria-label="厂商通用配置">
        <div className="grid grid-cols-1 gap-4 [&>div>label]:mb-2 [&>div>label]:leading-none sm:grid-cols-2">
          <Input label="厂商名称" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：通用模型服务" className="text-sm" />
          <Select label="上游格式" value={draft.protocol} onChange={(event) => changeProtocol(event.target.value as ProviderProtocol)} options={[{ value: 'responses', label: 'Responses' }, { value: 'chat-completions', label: 'Chat Completions' }, { value: 'anthropic-messages', label: 'Anthropic Messages' }]} className="text-sm" />
        </div>
        <Input label="通用 Base URL" type="url" value={draft.baseUrl} onChange={(event) => changeDefault('baseUrl', event.target.value)} placeholder="https://api.example.com/v1" className="text-xs" />
        <label className="block space-y-2">
          <span className="text-xs font-medium">通用 API Key</span>
          <span className="relative block">
            <Input type={showKey ? 'text' : 'password'} value={draft.apiKey} onChange={(event) => changeDefault('apiKey', event.target.value)} placeholder="输入通用 API Key" className="pr-10 text-xs" />
            <Button type="button" variant="ghost" size="iconSm" onClick={() => setShowKey((visible) => !visible)} aria-label={showKey ? '隐藏通用 API Key' : '显示通用 API Key'} title={showKey ? '隐藏通用 API Key' : '显示通用 API Key'} className="absolute right-1 top-1/2 -translate-y-1/2">{showKey ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}</Button>
          </span>
        </label>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">通用测试只验证鉴权、Base URL 和模型列表。</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => onTestCommon(activeCategory)} loading={testingTarget === 'common'} className="shrink-0">{testingTarget !== 'common' && <Wifi aria-hidden="true" size={14} />} {testingTarget === 'common' ? '正在测试' : '测试通用连接'}</Button>
        </div>
      </section>

      <div className="mt-2 flex gap-1 border-b border-border" role="tablist" aria-label="模型类型">
        {categories.map(({ id, label }) => (
          <button key={id} type="button" role="tab" aria-selected={activeCategory === id} onClick={() => setActiveCategory(id)} className={cn('relative flex h-10 min-w-24 items-center justify-center gap-2 px-4 text-xs text-muted-foreground', activeCategory === id && 'font-semibold text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground')}>
            {label}<Badge variant="subtle" className="px-1.5 py-0 text-[10px]">{getConfiguredModels(draft, id).length}</Badge>
          </button>
        ))}
      </div>

      <div className="mt-4" role="tabpanel">
        <div className="space-y-3">
          {models.map((model, index) => (
            <ProviderModelCard
              key={`${activeCategory}-${index}`}
              provider={draft}
              model={model}
              category={activeCategory}
              isDefault={getSelectedModel(draft, activeCategory) === model.id}
              testing={testingTarget === model.id}
              autoFocus={model.id === newModelId}
              onChange={(next) => changeModel(model.id, next)}
              onRemove={() => removeFromCategory(model)}
              onSetDefault={() => setDraft({ ...draft, selectedModels: { ...draft.selectedModels, [activeCategory]: model.id } })}
              onTest={() => onTestModel(activeCategory, model.id)}
            />
          ))}
          <button
            type="button"
            onClick={addModel}
            className="flex min-h-16 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border px-4 text-xs font-medium text-muted-foreground transition-colors hover:border-ring hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`添加${categories.find((item) => item.id === activeCategory)?.label}模型`}
          >
            <Plus aria-hidden="true" size={15} />
            添加{categories.find((item) => item.id === activeCategory)?.label}模型
          </button>
        </div>
      </div>

      {message && <p role="status" className={message.type === 'success' ? 'mt-3 text-xs text-muted-foreground' : 'mt-3 text-xs text-red-600'}>{message.text}</p>}
    </div>
  );
}
