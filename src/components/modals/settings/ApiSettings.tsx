import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../ui/Select';
import { confirmAction } from '../../ui/confirmation';
import { Label } from '../../ui/Label';
import { useId, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Download, Eye, EyeOff, Pencil, Plus, Power, Server, Trash2, Wifi } from '@/lib/remixIconShim';
import {
  getConfiguredModels,
  getSelectedModel,
  invalidateProviderModels,
  isProviderSaved,
  markModelsPending,
  migrateProviderStateV6,
  modelKeyHintUsable,
  providerKeyHintUsable,
  setModelsInCategory,
} from '../../../lib/providerConnections';
import { normalizeProviderBaseUrl } from '../../../lib/providerConfig';
import { cn } from '../../../lib/utils';
import { listProviderModels, testProviderModel } from '../../../services/providerService';
import {
  providerDefaults,
  useProviderStore,
  type ModelCategory,
  type ProviderConfig,
  type ProviderModel,
  type ProviderProtocol,
} from '../../../stores/useProviderStore';
import type { ProviderModelInfo } from '../../../types/provider';
import { Badge, Button, Card, Input } from '../../ui';
import { ProviderModelCard } from './ProviderModelCard';
import { ProviderModelPicker } from './ProviderModelPicker';

const categories: Array<{ id: ModelCategory; label: string }> = [
  { id: 'language', label: '文本' },
  { id: 'image', label: '生图' },
  { id: 'video', label: '视频' },
  { id: 'music', label: '音乐' },
];

const categoryLabels = Object.fromEntries(categories.map(({ id, label }) => [id, label])) as Record<ModelCategory, string>;

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

const isUnsupportedModelListError = (message: string) =>
  /模型列表|models|not found|unsupported|\b404\b|\b405\b/i.test(message);

const hasOverride = (model: ProviderModel, key: 'baseUrlOverride' | 'apiKeyOverride') =>
  Object.prototype.hasOwnProperty.call(model, key);

const keyHostChanged = (modelId?: string) => modelId
  ? `模型 ${modelId} 的 Base URL 域名（host）与保存时不同，已保存的 API Key 不会发送到新地址，请重新填写这个模型的 API Key`
  : 'Base URL 的域名（host）与保存时不同，已保存的 API Key 不会发送到新地址，请重新填写通用 API Key';

/** Key 留空时沿用网关里已保存的 Key，前提是要发往的地址没有超出保存时的范围。 */
const providerKeyError = (provider: ProviderConfig) => {
  if (provider.apiKey.trim()) return '';
  if (!provider.apiKeyHint) return '请填写通用 API Key';
  return providerKeyHintUsable(provider) ? '' : keyHostChanged();
};

const modelKeyError = (provider: ProviderConfig, model: ProviderModel) => {
  if (model.apiKeyOverride?.trim()) return '';
  if (model.apiKeyOverrideHint) return modelKeyHintUsable(provider, model) ? '' : keyHostChanged(model.id);
  return hasOverride(model, 'apiKeyOverride') ? `模型 ${model.id} 已选择自定义 Key，请填写完整` : '';
};

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
  const providerKey = providerKeyError(provider);
  if (providerKey) return providerKey;
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
    const modelKey = modelKeyError(provider, model);
    if (modelKey) return modelKey;
  }
  return '';
};

interface ApiSettingsProps {
  onEditingChange?: (editing: boolean) => void;
}

export function ApiSettings(props: ApiSettingsProps) {
  const status = useProviderStore((state) => state.status);
  const error = useProviderStore((state) => state.error);
  const load = useProviderStore((state) => state.load);

  // App 启动时已经开始读取，这里只是兜底；读取完成前不渲染列表，不会误显示“尚未添加”。
  useEffect(() => {
    if (status === 'idle') void load();
  }, [status, load]);

  if (status === 'ready') return <ApiSettingsContent {...props} />;
  if (status === 'error') {
    return (
      <div role="alert" className="flex min-h-56 flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold">API 配置没有读取成功</p>
        <p className="mt-1 max-w-md text-xs leading-5 text-red-600 dark:text-red-300">{error}</p>
        <Button type="button" onClick={() => void load()} variant="ghost" size="sm" className="mt-4 h-8">重新读取</Button>
      </div>
    );
  }
  return <p role="status" className="flex min-h-56 items-center justify-center text-xs text-muted-foreground">正在读取 API 配置…</p>;
}

function ApiSettingsContent({ onEditingChange }: ApiSettingsProps) {
  const {
    providers,
    activeProviderIds,
    syncError,
    clearSyncError,
    saveProvider: saveProviderConfig,
    importProviders: importProviderConfig,
    exportProviders: exportProviderConfig,
    setActiveProvider,
    removeProvider,
  } = useProviderStore();
  const importInputRef = useRef<HTMLInputElement>(null);
  const headerActionsTarget =
    typeof document === 'undefined' ? null : document.getElementById('settings-header-actions');
  const [draft, setDraft] = useState<ProviderConfig | null>(() =>
    providers.some(isProviderSaved) ? null : providers[0] || makeProvider());
  const [saving, setSaving] = useState(false);
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

  const saveProvider = async () => {
    if (!draft || saving) return;
    const error = validateProvider(draft);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    const provider = normalizeProvider(draft);
    const firstProvider = !savedProviders.length;
    setSaving(true);
    setMessage(null);
    try {
      await saveProviderConfig(provider);
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : '保存失败' });
      return;
    } finally {
      setSaving(false);
    }
    if (firstProvider) {
      categories.forEach(({ id }) => {
        if (getConfiguredModels(provider, id).length) setActiveProvider(id, provider.id);
      });
    }
    setDraft(null);
    setMessage({ type: 'success', text: `${provider.name} 已保存，模型默认继承通用连接` });
  };

  // 通用连接只读取模型列表，不需要先添加模型。
  const testCommonConnection = async (provider: ProviderConfig) => {
    setTestingTarget('common');
    setMessage(null);
    try {
      const result = await listProviderModels(provider);
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
    if (hasOverride(model, 'baseUrlOverride') && !model.baseUrlOverride?.trim()) {
      setMessage({ type: 'error', text: `请先完整填写模型 ${modelId} 的自定义连接` });
      return;
    }
    const keyError = modelKeyError(provider, model);
    if (keyError) {
      setMessage({ type: 'error', text: keyError });
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

  const activateProvider = async (provider: ProviderConfig, category: ModelCategory) => {
    const selected = provider.models.find((model) => model.id === getSelectedModel(provider, category));
    const status = selected?.verification?.status || 'pending';
    if (status !== 'healthy') {
      const label = categories.find((item) => item.id === category)?.label;
      const confirmed = await confirmAction(
        `${provider.name} 的${label}默认模型当前为“${statusLabels[status]}”。\nHost：${providerHost(selected?.baseUrlOverride || provider.baseUrl)}\n\n仍要启用并允许实际请求继续吗？`,
      );
      if (!confirmed) return;
    }
    setActiveProvider(category, provider.id);
    setMessage({ type: 'success', text: `${provider.name} 已设为当前${categories.find((item) => item.id === category)?.label}厂商` });
  };

  const activateProviderForAllCategories = async (provider: ProviderConfig) => {
    const configuredCategories = categories.filter(({ id }) => getConfiguredModels(provider, id).length > 0);
    const unverifiedCategories = configuredCategories.filter(({ id }) => {
      const selected = provider.models.find((model) => model.id === getSelectedModel(provider, id));
      return (selected?.verification?.status || 'pending') !== 'healthy';
    });

    if (unverifiedCategories.length) {
      const confirmed = await confirmAction(
        `${provider.name} 的${unverifiedCategories.map(({ label }) => label).join('、')}默认模型尚未全部验证。\nHost：${providerHost(provider.baseUrl)}\n\n仍要启用并允许实际请求继续吗？`,
      );
      if (!confirmed) return;
    }

    configuredCategories.forEach(({ id }) => setActiveProvider(id, provider.id));
    setMessage({ type: 'success', text: `${provider.name} 已启用` });
  };

  // 浏览器里没有完整的 Key，导出文件由网关生成。
  const exportProviders = async () => {
    try {
      const payload = await exportProviderConfig();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `design-work-providers-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'API 配置已导出（包含 API Key，请妥善保管）' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '导出失败' });
    }
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
      // 同 ID 的厂商换成文件里的版本，文件里的默认厂商覆盖现有设置。
      await importProviderConfig(
        { providers: imported, activeProviderIds: migrated.activeProviderIds },
        'replace-matching',
      );
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
            <Button type="button" onClick={() => void exportProviders()} variant="ghost" size="sm" disabled={!providers.length} className="h-8">导出数据</Button>
            <Button type="button" onClick={() => { setDraft(makeProvider()); setMessage(null); }} variant="ghost" size="sm" className="h-8 gap-1.5"><Plus aria-hidden="true" size={15} /> 添加厂商</Button>
          </div>,
          headerActionsTarget,
        )}

      <div className="space-y-5">
        {syncError && (
          <div role="alert" className="flex items-start justify-between gap-3 text-xs leading-5 text-red-600 dark:text-red-300">
            <p className="min-w-0">{syncError}</p>
            <Button type="button" variant="ghost" size="sm" onClick={clearSyncError} className="h-7 shrink-0 px-2 text-xs">知道了</Button>
          </div>
        )}
        {draft ? (
          <ProviderEditor
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            testingTarget={testingTarget}
            message={message}
            onTestCommon={() => void testCommonConnection(draft)}
            onTestModel={(category, modelId) => void testModel(draft, category, modelId)}
            onSave={() => void saveProvider()}
            onCancel={() => { setDraft(null); setMessage(null); }}
          />
        ) : savedProviders.length ? (
        <div className="flex flex-col gap-4">
          {savedProviders.map((provider) => {
            const expanded = expandedProviderIds.has(provider.id);
            const configuredCategoryIds = categories
              .filter(({ id }) => getConfiguredModels(provider, id).length > 0)
              .map(({ id }) => id);
            const providerEnabled = configuredCategoryIds.length > 0
              && configuredCategoryIds.every((id) => activeProviderIds[id] === provider.id);
            return (
              <Card key={provider.id} padding="none" className="overflow-hidden border-border">
                <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-muted"><Server aria-hidden="true" size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <h5 className="truncate text-sm font-semibold">{provider.name}</h5>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{providerHost(provider.baseUrl)} / {provider.models.length} 个模型</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={providerEnabled}
                    onClick={() => activateProviderForAllCategories(provider)}
                    className="h-8 min-w-[72px] gap-1.5 px-2 text-xs disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                  >
                    {providerEnabled
                      ? <Check aria-hidden="true" size={13} />
                      : <Power aria-hidden="true" size={13} />}
                    {providerEnabled ? '已启用' : '启用'}
                  </Button>
                  <Button type="button" variant="ghost" size="iconSm" onClick={() => beginEdit(provider)} aria-label={`编辑 ${provider.name}`} title={`编辑 ${provider.name}`} className="h-8 w-8"><Pencil aria-hidden="true" size={13} /></Button>
                  <Button type="button" variant="ghost" size="iconSm" onClick={async () => { if (await confirmAction(`确定删除 API 厂商“${provider.name}”吗？`)) removeProvider(provider.id); }} aria-label={`删除 ${provider.name}`} title={`删除 ${provider.name}`} className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 aria-hidden="true" size={14} /></Button>
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
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{models.length ? `${models.length} 个模型 / ${getSelectedModel(provider, id)}` : '未配置'}</span>
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
  saving: boolean;
  testingTarget: string;
  message: { type: 'success' | 'error'; text: string } | null;
  onTestCommon: () => void;
  onTestModel: (category: ModelCategory, modelId: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

interface FetchedModels {
  models: ProviderModelInfo[];
  checkedAt: number;
  latency: number;
}

function ProviderEditor({ draft, setDraft, saving, testingTarget, message, onTestCommon, onTestModel, onSave, onCancel }: ProviderEditorProps) {
  const fieldId1 = useId();
  const fieldId2 = useId();
  const fieldId3 = useId();
  const [activeCategory, setActiveCategory] = useState<ModelCategory>('language');
  const [newModelId, setNewModelId] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [fetched, setFetched] = useState<FetchedModels | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  // 连接信息变化后，进行中的获取结果作废。
  const fetchSeq = useRef(0);
  const models = getConfiguredModels(draft, activeCategory);
  // 已保存的 Key 只留在本机网关，这里只显示掩码；留空表示继续使用。
  const keyPlaceholder = !draft.apiKeyHint
    ? '输入通用 API Key'
    : providerKeyHintUsable(draft)
      ? `已保存 ${draft.apiKeyHint.masked}，留空继续使用`
      : 'Base URL 域名已变化，请重新填写通用 API Key';

  const resetFetched = () => {
    fetchSeq.current += 1;
    setFetched(null);
    setFetching(false);
    setFetchError('');
  };

  const changeProtocol = (protocol: ProviderProtocol) => {
    const previousDefault = providerDefaults[draft.protocol].baseUrl;
    const invalidated = invalidateProviderModels(draft, 'protocol');
    resetFetched();
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
    resetFetched();
    setDraft({ ...invalidated, [field]: value });
  };

  const fetchModels = async () => {
    const seq = ++fetchSeq.current;
    setFetching(true);
    setFetchError('');
    try {
      const result = await listProviderModels(draft);
      if (seq !== fetchSeq.current) return;
      if (!result.models.length) {
        setFetched(null);
        setFetchError('上游返回的模型列表为空，请手动添加模型');
        return;
      }
      setFetched({ models: result.models, checkedAt: Date.now(), latency: result.latency });
    } catch (error) {
      if (seq !== fetchSeq.current) return;
      const text = error instanceof Error ? error.message : '获取模型失败';
      setFetchError(/\b40[45]\b/.test(text)
        ? `${text.replace(/[。.]$/, '')}。该上游可能不提供模型列表接口，请手动添加模型`
        : text);
    } finally {
      if (seq === fetchSeq.current) setFetching(false);
    }
  };

  // 出现在上游模型列表里的模型，与单个模型测试的判定相同，直接记为已验证。
  const toggleFetchedModels = (ids: string[], included: boolean) => {
    if (!fetched) return;
    setDraft(setModelsInCategory(draft, activeCategory, ids, included, {
      status: 'healthy',
      checkedAt: fetched.checkedAt,
      latency: fetched.latency,
    }));
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
          <Button type="button" variant="primary" size="sm" onClick={onSave} loading={saving} className="bg-foreground text-background hover:bg-foreground/85">{!saving && <Check aria-hidden="true" size={14} />} {saving ? '正在保存' : '保存厂商'}</Button>
        </div>
      </header>

      <section className="space-y-4 rounded-[var(--radius)] bg-muted/45 p-4" aria-label="厂商通用配置">
        <div className="grid grid-cols-1 gap-4 [&>div>label]:mb-2 [&>div>label]:leading-none sm:grid-cols-2">
          <div className="w-full">
            <Label htmlFor={fieldId1} className="mb-1.5 block text-sm font-medium text-foreground">
              厂商名称
            </Label>
            <Input
              id={fieldId1}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="例如：通用模型服务"
              className="text-sm"
            />
          </div>
          <div className="w-full">
            <Label htmlFor={fieldId2} className="mb-1.5 block text-sm font-medium text-foreground">
              上游格式
            </Label>
            <Select
              value={draft.protocol}
              onValueChange={(value) => changeProtocol(value as ProviderProtocol)}
            >
              <SelectTrigger id={fieldId2} className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: 'responses', label: 'Responses' },
                  { value: 'chat-completions', label: 'Chat Completions' },
                  { value: 'anthropic-messages', label: 'Anthropic Messages' },
                ].map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="w-full">
          <Label htmlFor={fieldId3} className="mb-1.5 block text-sm font-medium text-foreground">
            通用 Base URL
          </Label>
          <Input
            id={fieldId3}
            type="url"
            value={draft.baseUrl}
            onChange={(event) => changeDefault('baseUrl', event.target.value)}
            placeholder="https://api.example.com/v1"
            className="text-xs"
          />
        </div>
        <label className="block space-y-2">
          <span className="text-xs font-medium">通用 API Key</span>
          <span className="relative block">
            <Input type={showKey ? 'text' : 'password'} value={draft.apiKey} onChange={(event) => changeDefault('apiKey', event.target.value)} placeholder={keyPlaceholder} className="pr-10 text-xs" />
            <Button type="button" variant="ghost" size="iconSm" onClick={() => setShowKey((visible) => !visible)} aria-label={showKey ? '隐藏通用 API Key' : '显示通用 API Key'} title={showKey ? '隐藏通用 API Key' : '显示通用 API Key'} className="absolute right-1 top-1/2 -translate-y-1/2">{showKey ? <EyeOff aria-hidden="true" size={15} /> : <Eye aria-hidden="true" size={15} />}</Button>
          </span>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">获取模型和通用测试都只读取模型列表，不发起生成。</p>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => void fetchModels()} loading={fetching}>{!fetching && <Download aria-hidden="true" size={14} />} {fetching ? '正在获取' : fetched ? '重新获取' : '获取模型'}</Button>
            <Button type="button" variant="secondary" size="sm" onClick={onTestCommon} loading={testingTarget === 'common'}>{testingTarget !== 'common' && <Wifi aria-hidden="true" size={14} />} {testingTarget === 'common' ? '正在测试' : '测试通用连接'}</Button>
          </div>
        </div>
        {fetchError && <p role="alert" className="text-xs text-red-600">{fetchError}</p>}
      </section>

      <div className="mt-2 flex gap-1 border-b border-border" role="tablist" aria-label="模型类型">
        {categories.map(({ id, label }) => (
          <button key={id} type="button" role="tab" aria-selected={activeCategory === id} onClick={() => setActiveCategory(id)} className={cn('relative flex h-10 min-w-24 items-center justify-center gap-2 px-4 text-xs text-muted-foreground', activeCategory === id && 'font-semibold text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground')}>
            {label}<Badge variant="subtle" className="px-1.5 py-0 text-[10px]">{getConfiguredModels(draft, id).length}</Badge>
          </button>
        ))}
      </div>

      <div className="mt-4" role="tabpanel">
        {fetched && (
          <ProviderModelPicker
            models={fetched.models}
            provider={draft}
            category={activeCategory}
            categoryLabels={categoryLabels}
            onToggle={toggleFetchedModels}
            onClose={() => setFetched(null)}
          />
        )}
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
