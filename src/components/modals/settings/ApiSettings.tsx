import { useState } from 'react';
import {
  Check,
  ChevronDown,
  Cpu,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Power,
  Server,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import { testProvider } from '../../../services/providerService';
import { normalizeProviderBaseUrl } from '../../../lib/providerConfig';
import {
  getConfiguredModels,
  getModelCategories,
  getSelectedModel,
  modelSupportsCategory,
  providerDefaults,
  useProviderStore,
  type ConfiguredModel,
  type ModelCategory,
  type ProviderConfig,
  type ProviderProtocol,
} from '../../../stores/useProviderStore';
import { cn } from '../../../lib/utils';
import { Badge, Button, Card, Input, Select } from '../../ui';

const protocolLabels: Record<ProviderProtocol, string> = {
  responses: 'Responses',
  'chat-completions': 'Chat Completions',
  'anthropic-messages': 'Anthropic Messages',
};

const modelCapabilities: Array<{
  id: ModelCategory;
  label: string;
  activeClass: string;
}> = [
  {
    id: 'language',
    label: '文本',
    activeClass: 'border-black/[0.08] bg-black/[0.055] text-foreground dark:border-white/[0.1] dark:bg-white/[0.08]',
  },
  {
    id: 'image',
    label: '生图',
    activeClass: 'border-black/[0.08] bg-black/[0.055] text-foreground dark:border-white/[0.1] dark:bg-white/[0.08]',
  },
  {
    id: 'video',
    label: '视频',
    activeClass: 'border-black/[0.08] bg-black/[0.055] text-foreground dark:border-white/[0.1] dark:bg-white/[0.08]',
  },
];

const makeProvider = (): ProviderConfig => ({
  id: crypto.randomUUID(),
  protocol: 'responses',
  apiKey: '',
  models: [],
  enabled: true,
  ...providerDefaults.responses,
  model: '',
});

const providerHost = (baseUrl: string) => {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
};

const isProviderSaved = (provider: ProviderConfig | undefined) => Boolean(
  provider?.savedAt
  || provider?.apiKey.trim()
  || provider?.models.length
  || provider?.configuredModels?.length,
);

export function ApiSettings() {
  const { providers, activeProviderId, setActiveProvider, upsertProvider, removeProvider } = useProviderStore();
  const initialProvider = providers.find((provider) => provider.id === activeProviderId) || providers[0];
  const [draft, setDraft] = useState<ProviderConfig | null>(() => isProviderSaved(initialProvider) ? null : initialProvider || null);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedProviderIds, setExpandedProviderIds] = useState<Set<string>>(() => new Set());
  const savedProviders = providers.filter(isProviderSaved);
  const toggleProviderModels = (providerId: string) => {
    setExpandedProviderIds((current) => {
      const next = new Set(current);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
  };

  const beginNewProvider = () => {
    setDraft(makeProvider());
    setMessage(null);
  };

  const beginEdit = (provider: ProviderConfig) => {
    setDraft({ ...provider, configuredModels: getConfiguredModels(provider) });
    setMessage(null);
  };

  const cancelEdit = () => {
    setDraft(null);
    setMessage(null);
  };

  const saveProvider = async () => {
    if (!draft) return;
    const shouldActivate = !savedProviders.length || draft.id === activeProviderId;
    const provider: ProviderConfig = {
      ...draft,
      baseUrl: normalizeProviderBaseUrl(draft.protocol, draft.baseUrl),
      configuredModels: getConfiguredModels(draft),
      enabled: shouldActivate,
      savedAt: Date.now(),
    };
    upsertProvider(provider);
    if (shouldActivate) setActiveProvider(provider.id);
    setDraft(null);
    setMessage({ type: 'success', text: `${provider.name || 'API 厂商'} 已保存，本地画板会直接读取模型配置` });
  };

  const testDraft = async () => {
    if (!draft) return;
    setTesting(true);
    setMessage(null);
    const startedAt = Date.now();
    try {
      const result = await testProvider(draft);
      const configuredModels = getConfiguredModels(draft);
      const discoveredModels = result.models.filter(
        (modelId) => !configuredModels.some((model) => model.id === modelId),
      );
      setDraft({
        ...draft,
        baseUrl: result.normalizedBaseUrl,
        models: result.models,
        configuredModels: [
          ...configuredModels,
          ...discoveredModels.map((id) => ({ id })),
        ],
        health: { status: 'healthy', latency: result.latency, checkedAt: Date.now() },
      });
      setMessage({ type: 'success', text: `验证通过，延迟 ${result.latency}ms，发现 ${result.models.length} 个模型` });
    } catch (error) {
      const text = error instanceof Error ? error.message : '连接失败';
      setDraft({
        ...draft,
        health: { status: 'unhealthy', latency: Date.now() - startedAt, checkedAt: Date.now(), error: text },
      });
      setMessage({ type: 'error', text });
    } finally {
      setTesting(false);
    }
  };

  const deleteProvider = (provider: ProviderConfig) => {
    if (!window.confirm(`确定删除 API 厂商“${provider.name}”吗？`)) return;
    removeProvider(provider.id);
    setMessage({ type: 'success', text: `${provider.name} 已删除` });
  };

  const activateProvider = (provider: ProviderConfig) => {
    setActiveProvider(provider.id);
    setMessage({ type: 'success', text: `${provider.name} 已启用` });
  };

  return (
    <div className="space-y-5">
      {!draft && (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold">API 厂商</h4>
            <p className="mt-1 text-xs text-slate-400">每个厂商独立保存模型与连接配置。</p>
          </div>
          <Button type="button" onClick={beginNewProvider} variant="primary" size="sm" className="shrink-0 bg-foreground text-background hover:bg-foreground/85"><Plus aria-hidden="true" size={15} /> 添加厂商</Button>
        </div>
      )}

      {draft ? (
        <ProviderEditor
          draft={draft}
          setDraft={setDraft}
          testing={testing}
          message={message}
          onTest={() => void testDraft()}
          onSave={() => void saveProvider()}
          onCancel={cancelEdit}
        />
      ) : savedProviders.length ? (
        <div className="flex w-full flex-col gap-4">
          {savedProviders.map((provider) => {
            const models = getConfiguredModels(provider);
            const active = provider.id === activeProviderId;
            const modelsExpanded = expandedProviderIds.has(provider.id);
            return (
              <Card
                key={provider.id}
                padding="none"
                className={`w-full min-w-0 overflow-hidden transition-[border-color,box-shadow] ${
                  active
                    ? 'border-black/[0.08] shadow-[0_0_0_1px_rgba(0,0,0,0.025)] dark:border-white/[0.1] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.035)]'
                    : 'border-black/[0.045] dark:border-white/[0.06]'
                }`}
              >
                <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-black/[0.055] text-foreground dark:bg-white/[0.08]"><Server aria-hidden="true" size={18} /></span>
                  <div className="min-w-0 flex-1 pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h5 className="truncate text-sm font-semibold">{provider.name}</h5>
                      {active && <Badge variant="subtle" className="bg-black/[0.07] text-xs text-foreground dark:bg-white/[0.1]">已启用</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={cn('grid h-8 w-8 place-items-center text-muted-foreground', provider.health?.status === 'unhealthy' && 'text-destructive')} title={provider.health?.status === 'unhealthy' ? '连接异常' : `${protocolLabels[provider.protocol]} · ${providerHost(provider.baseUrl)}`}>
                      {provider.health?.status === 'unhealthy' ? <X aria-hidden="true" size={14} /> : <Check aria-hidden="true" size={14} />}
                    </span>
                    {!active && <Button type="button" onClick={() => activateProvider(provider)} aria-pressed={false} size="sm" variant="ghost" className="h-8 px-2 text-xs"><Power aria-hidden="true" size={13} /> 启用</Button>}
                    <Button type="button" variant="ghost" size="sm" onClick={() => beginEdit(provider)} className="h-8 px-2 text-xs"><Pencil aria-hidden="true" size={13} /> 编辑</Button>
                    <Button type="button" variant="ghost" size="iconSm" onClick={() => deleteProvider(provider)} aria-label={`删除 ${provider.name}`} title={`删除 ${provider.name}`} className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 aria-hidden="true" size={14} /></Button>
                  </div>
                </div>

                <section className="border-t border-black/[0.045] dark:border-white/[0.06]" aria-label={provider.name + ' 模型信息'}>
                  <Button type="button" variant="ghost" onClick={() => toggleProviderModels(provider.id)} aria-expanded={modelsExpanded} className="mx-4 my-2 h-8 w-[calc(100%-2rem)] justify-between rounded-md px-2 text-left sm:mx-5 sm:w-[calc(100%-2.5rem)]">
                    <span className="flex min-w-0 items-center gap-2">
                      <Cpu aria-hidden="true" size={15} className="shrink-0 text-muted-foreground" />
                      <span className="text-xs font-semibold">模型信息</span>
                      <Badge variant="secondary" className="font-mono text-xs">{models.length}</Badge>
                      <span className="truncate text-xs font-normal text-muted-foreground">{models.length ? models.slice(0, 2).map((model) => model.id).join('、') : '尚未配置'}</span>
                    </span>
                    <ChevronDown aria-hidden="true" size={15} className={cn('shrink-0 text-muted-foreground transition-transform', modelsExpanded && 'rotate-180')} />
                  </Button>

                  {modelsExpanded && (models.length ? (
                    <ul className="grid w-full gap-2 px-4 pb-4 pt-1 md:grid-cols-2 sm:px-5">
                      {models.map((model) => {
                        const categories = getModelCategories(model);
                        const defaultFor = modelCapabilities.filter(
                          (capability) => getSelectedModel(provider, capability.id) === model.id,
                        );
                        return (
                          <li key={model.id} className="flex min-w-0 flex-col gap-2 rounded-md border border-black/[0.045] bg-muted/25 px-3.5 py-3 dark:border-white/[0.06] lg:flex-row lg:items-center">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <Cpu aria-hidden="true" size={14} className="shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium" title={model.id}>{model.id}</span>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-1.5">
                              {categories.length ? categories.map((category) => {
                                const capability = modelCapabilities.find((item) => item.id === category);
                                return capability ? <Badge key={category} variant="outline" className={cn('px-2 py-0 text-xs', capability.activeClass)}>{capability.label}</Badge> : null;
                              }) : <Badge variant="subtle" className="px-2 py-0 text-xs">未分类</Badge>}
                              {defaultFor.map((capability) => (
                                <Badge key={`default-${capability.id}`} variant="subtle" className="bg-black/[0.07] px-2 py-0 text-xs text-foreground dark:bg-white/[0.1]">默认{capability.label}</Badge>
                              ))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mx-4 mb-4 rounded-md border border-dashed border-black/[0.08] px-3 py-3 text-xs text-muted-foreground dark:border-white/[0.1] sm:mx-5">尚未配置模型，点击编辑后添加模型 ID。</p>
                  ))}
                </section>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card variant="ghost" className="flex min-h-56 w-full flex-col items-center justify-center border-dashed border-black/[0.08] text-center dark:border-white/[0.1]"><span className="grid h-11 w-11 place-items-center rounded-md bg-black/[0.055] text-foreground dark:bg-white/[0.08]"><Server aria-hidden="true" size={19} /></span><p className="mt-4 text-sm font-semibold">尚未添加 API 厂商</p><Button type="button" onClick={beginNewProvider} variant="primary" size="sm" className="mt-4 bg-foreground text-background hover:bg-foreground/85"><Plus aria-hidden="true" size={15} /> 添加厂商</Button></Card>
      )}

      {!draft && message && <p role="status" className={message.type === 'success' ? 'text-xs text-muted-foreground' : 'text-xs text-red-600'}>{message.text}</p>}
    </div>
  );
}

function ProviderEditor({ draft, setDraft, testing, message, onTest, onSave, onCancel }: { draft: ProviderConfig; setDraft: (provider: ProviderConfig) => void; testing: boolean; message: { type: 'success' | 'error'; text: string } | null; onTest: () => void; onSave: () => void; onCancel: () => void }) {
  const [showKey, setShowKey] = useState(false);
  const [pendingModelId, setPendingModelId] = useState('');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingModelValue, setEditingModelValue] = useState('');
  const configuredModels = getConfiguredModels(draft);
  const changeProtocol = (protocol: ProviderProtocol) => setDraft({
    ...draft,
    protocol,
    ...providerDefaults[protocol],
    model: '',
    models: [],
    configuredModels: [],
    modelSelections: {},
    health: undefined,
  });
  const addModel = () => {
    const id = pendingModelId.trim();
    if (!id || configuredModels.some((model) => model.id === id)) return;
    const categories: ModelCategory[] = ['language'];
    const next: ConfiguredModel[] = [
      ...configuredModels,
      { id, category: categories[0], categories },
    ];
    const modelSelections = { ...draft.modelSelections };
    for (const category of categories) {
      if (!modelSelections[category]) modelSelections[category] = id;
    }
    setDraft({
      ...draft,
      model: draft.model || (categories.includes('language') ? id : ''),
      configuredModels: next,
      modelSelections,
    });
    setPendingModelId('');
  };
  const updateModelCategories = (model: ConfiguredModel, category: ModelCategory) => {
    const currentCategories = getModelCategories(model);
    const categories = currentCategories.includes(category)
      ? currentCategories.filter((item) => item !== category)
      : [...currentCategories, category];
    const next = configuredModels.map((item) => (
      item.id === model.id
        ? { ...item, category: categories[0], categories }
        : item
    ));
    const modelSelections = { ...draft.modelSelections };
    if (categories.includes(category)) {
      if (!modelSelections[category]) modelSelections[category] = model.id;
    } else if (modelSelections[category] === model.id) {
      modelSelections[category] = next.find((item) =>
        item.id !== model.id && modelSupportsCategory(item, category))?.id;
    }
    const languageModel = categories.includes('language')
      ? model.id
      : next.find((item) => modelSupportsCategory(item, 'language'))?.id || '';
    setDraft({
      ...draft,
      model: draft.model === model.id && !categories.includes('language')
        ? languageModel
        : draft.model || languageModel,
      configuredModels: next,
      modelSelections,
    });
  };
  const beginEditModel = (id: string) => {
    setEditingModelId(id);
    setEditingModelValue(id);
  };
  const cancelEditModel = () => {
    setEditingModelId(null);
    setEditingModelValue('');
  };
  const saveModelId = () => {
    if (!editingModelId) return;
    const nextId = editingModelValue.trim();
    if (!nextId || configuredModels.some((model) => model.id === nextId && model.id !== editingModelId)) return;
    const configuredModelsNext = configuredModels.map((model) =>
      model.id === editingModelId ? { ...model, id: nextId } : model,
    );
    const modelSelections = Object.fromEntries(
      Object.entries(draft.modelSelections || {}).map(([category, selected]) => [
        category,
        selected === editingModelId ? nextId : selected,
      ]),
    );
    setDraft({
      ...draft,
      model: draft.model === editingModelId ? nextId : draft.model,
      configuredModels: configuredModelsNext,
      modelSelections,
    });
    cancelEditModel();
  };
  const removeModel = (id: string) => {
    const next = configuredModels.filter((model) => model.id !== id);
    setDraft({ ...draft, model: draft.model === id ? next.find((model) => modelSupportsCategory(model, 'language'))?.id || '' : draft.model, configuredModels: next, modelSelections: Object.fromEntries(Object.entries(draft.modelSelections || {}).filter(([, selected]) => selected !== id)) });
    if (editingModelId === id) cancelEditModel();
  };
  const selectDefaultModel = (category: ModelCategory, modelId: string) => {
    const modelSelections = { ...draft.modelSelections, [category]: modelId || undefined };
    setDraft({
      ...draft,
      model: category === 'language' ? modelId : draft.model,
      modelSelections,
    });
  };

  return (
    <Card aria-label="API 厂商编辑表单" padding="lg" className="border-black/[0.045] dark:border-white/[0.06]">
      <div className="mb-5 flex items-center justify-between"><div><h5 className="text-sm font-semibold">{draft.savedAt ? `编辑 ${draft.name}` : '添加 API 厂商'}</h5><p className="mt-1 text-xs text-muted-foreground">保存后将以卡片形式展示。</p></div><Button type="button" variant="ghost" size="iconSm" onClick={onCancel} aria-label="取消编辑 API 厂商"><X aria-hidden="true" size={16} /></Button></div>
      <div className="grid grid-cols-1 gap-4 [&>div>label]:mb-2 [&>div>label]:leading-none sm:grid-cols-2"><Input label="名称" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="text-xs" /><Select label="上游格式" value={draft.protocol} onChange={(event) => changeProtocol(event.target.value as ProviderProtocol)} options={[{ value: 'responses', label: 'Responses' }, { value: 'chat-completions', label: 'Chat Completions' }, { value: 'anthropic-messages', label: 'Anthropic Messages' }]} /></div>
      <div className="mt-4 space-y-4 rounded-md bg-muted/45 p-4">
        <Input label="Base URL" type="url" value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" className="text-xs" />
        <label className="block space-y-2">
          <span className="text-xs font-medium">API Key</span>
          <span className="relative block">
            <Input type={showKey ? 'text' : 'password'} value={draft.apiKey} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} placeholder="sk-..." className="pr-10 text-xs" />
            <Button type="button" variant="ghost" size="iconSm" onClick={() => setShowKey((visible) => !visible)} aria-label={showKey ? '隐藏 API 密钥' : '显示 API 密钥'} className="absolute right-1 top-1/2 -translate-y-1/2">{showKey ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}</Button>
          </span>
        </label>
        <section aria-labelledby="provider-model-ids" className="space-y-2">
          <h6 id="provider-model-ids" className="text-xs font-medium text-slate-600 dark:text-slate-300">模型</h6>
          <form onSubmit={(event) => { event.preventDefault(); addModel(); }}>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="provider-model-id">新增模型 ID</label>
              <Input id="provider-model-id" inputSize="sm" value={pendingModelId} onChange={(event) => setPendingModelId(event.target.value)} placeholder="model-id" className="min-w-0 flex-1 text-xs" />
              <Button type="submit" variant="primary" size="sm" disabled={!pendingModelId.trim()} className="h-8 shrink-0 bg-foreground text-background hover:bg-foreground/85"><Plus aria-hidden="true" size={14} /> 添加</Button>
            </div>
          </form>
          {configuredModels.length ? (
            <ul className="space-y-2" aria-label="已添加模型 ID">
              {configuredModels.map((model) => {
                const editing = editingModelId === model.id;
                return (
                  <li key={model.id} className="flex min-h-10 items-center gap-2 rounded-md border border-black/[0.055] bg-card px-3 py-2 dark:border-white/[0.07]">
                    {editing ? (
                      <>
                        <label className="sr-only" htmlFor={`model-id-${model.id}`}>编辑模型 ID</label>
                        <Input
                          id={`model-id-${model.id}`}
                          autoFocus
                          value={editingModelValue}
                          onChange={(event) => setEditingModelValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') cancelEditModel();
                          }}
                          inputSize="sm" className="min-w-0 flex-1 text-xs font-semibold"
                        />
                        <Button type="button" variant="ghost" size="iconSm" onClick={saveModelId} disabled={!editingModelValue.trim()} aria-label={`保存模型 ${model.id}`} className="h-7 w-7 text-foreground"><Check aria-hidden="true" size={14} /></Button>
                        <Button type="button" variant="ghost" size="iconSm" onClick={cancelEditModel} aria-label="取消编辑模型 ID" className="h-7 w-7"><X aria-hidden="true" size={14} /></Button>
                      </>
                    ) : (
                      <>
                        <Cpu aria-hidden="true" size={13} className={getModelCategories(model).length ? 'shrink-0 text-foreground/70' : 'shrink-0 text-slate-300 dark:text-zinc-700'} />
                        <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">{model.id}</span>
                        <div className="flex shrink-0 items-center gap-1" aria-label={model.id + ' 模型能力'}>
                          {modelCapabilities.map((capability) => {
                            const active = getModelCategories(model).includes(capability.id);
                            return (
                              <Button key={capability.id} type="button" variant={active ? 'secondary' : 'ghost'} size="sm" aria-pressed={active} onClick={() => updateModelCategories(model, capability.id)} className={cn('h-6 px-1.5 text-xs', active && capability.activeClass)}>{capability.label}</Button>
                            );
                          })}
                        </div>
                        <Button type="button" variant="ghost" size="iconSm" onClick={() => beginEditModel(model.id)} aria-label={`编辑模型 ${model.id}`} className="h-7 w-7"><Pencil aria-hidden="true" size={13} /></Button>
                        <Button type="button" variant="ghost" size="iconSm" onClick={() => removeModel(model.id)} aria-label={`移除模型 ${model.id}`} className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"><Trash2 aria-hidden="true" size={13} /></Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-black/[0.08] px-3 py-3 text-xs text-slate-400 dark:border-white/10">尚未添加模型 ID。</p>
          )}
          <section aria-labelledby="provider-default-models" className="rounded-md bg-card p-3">
            <div>
              <h6 id="provider-default-models" className="text-xs font-medium text-slate-600 dark:text-slate-300">默认模型</h6>
              <p className="mt-1 text-xs text-slate-400">生成中心会按这里的默认值使用对应能力模型，也可以在生成时临时切换。</p>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {modelCapabilities.map((capability) => {
                const options = configuredModels.filter((model) => modelSupportsCategory(model, capability.id));
                const selected = getSelectedModel(draft, capability.id);
                return (
                  <Select key={capability.id} label={capability.label}
                      value={selected}
                      onChange={(event) => selectDefaultModel(capability.id, event.target.value)}
                      disabled={!options.length}
                      aria-label={`${capability.label}默认模型`}
                      selectSize="sm" className="min-w-0 text-xs"
                      options={options.length ? options.map((model) => ({ value: model.id, label: model.id })) : [{ value: '', label: '暂无模型' }]}
                  />
                );
              })}
            </div>
          </section>
        </section>
      </div>
      {message && <p role="status" className={message.type === 'success' ? 'mt-3 text-xs text-muted-foreground' : 'mt-3 text-xs text-red-600'}>{message.text}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={onCancel}>取消</Button><Button type="button" variant="secondary" size="sm" onClick={onTest} loading={testing}>{!testing && <Wifi aria-hidden="true" size={14} />} {testing ? '正在测试' : '测试连接'}</Button><Button type="button" variant="primary" size="sm" onClick={onSave} className="bg-foreground text-background hover:bg-foreground/85"><Check aria-hidden="true" size={14} /> 保存厂商</Button></div>
    </Card>
  );
}
