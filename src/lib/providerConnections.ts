import type {
  ActiveProviderIds,
  ModelCategory,
  ProviderConfig,
  ProviderModel,
  ProviderProtocol,
  ProviderStateSnapshot,
  ProviderVerification,
  ResolvedProviderConnection,
  VerificationStatus,
} from '../types/provider';

export const MODEL_CATEGORIES: ModelCategory[] = ['language', 'image', 'video'];

const normalizeProtocol = (value: unknown): ProviderProtocol => {
  if (value === 'anthropic' || value === 'anthropic-messages') return 'anthropic-messages';
  if (value === 'openai' || value === 'gemini' || value === 'chat-completions') return 'chat-completions';
  return 'responses';
};

const normalizeVerificationStatus = (value: unknown): VerificationStatus => {
  if (value === 'healthy' || value === 'unhealthy' || value === 'unverified') return value;
  return 'pending';
};

const normalizeVerification = (value: unknown): ProviderVerification => {
  const verification = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    status: normalizeVerificationStatus(verification.status),
    ...(typeof verification.checkedAt === 'number' ? { checkedAt: verification.checkedAt } : {}),
    ...(typeof verification.latency === 'number' ? { latency: verification.latency } : {}),
    ...(typeof verification.error === 'string' ? { error: verification.error } : {}),
  };
};

const normalizeCategories = (value: unknown): ModelCategory[] => {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(source.filter((category): category is ModelCategory =>
    MODEL_CATEGORIES.includes(category as ModelCategory)))];
};

const normalizeModel = (value: unknown): ProviderModel | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const model = value as Record<string, unknown>;
  const id = String(model.id || '').trim();
  const categories = normalizeCategories(model.categories || model.category);
  if (!id || !categories.length) return undefined;
  const baseUrlOverride = String(model.baseUrlOverride || '').trim();
  const apiKeyOverride = String(model.apiKeyOverride || '').trim();
  return {
    id,
    categories,
    ...(baseUrlOverride ? { baseUrlOverride } : {}),
    ...(apiKeyOverride ? { apiKeyOverride } : {}),
    verification: normalizeVerification(model.verification),
  };
};

const normalizeV6Provider = (value: Record<string, any>): ProviderConfig => {
  const models = (Array.isArray(value.models) ? value.models : [])
    .map(normalizeModel)
    .filter((model): model is ProviderModel => Boolean(model));
  const selectedModels = Object.fromEntries(MODEL_CATEGORIES.flatMap((category) => {
    const selected = String(value.selectedModels?.[category] || '');
    return selected && models.some((model) => model.id === selected && model.categories.includes(category))
      ? [[category, selected]]
      : [];
  }));
  return {
    id: String(value.id || crypto.randomUUID()),
    name: String(value.name || '未命名厂商'),
    protocol: normalizeProtocol(value.protocol),
    baseUrl: String(value.baseUrl || '').trim(),
    apiKey: String(value.apiKey || '').trim(),
    models,
    selectedModels,
    savedAt: typeof value.savedAt === 'number' ? value.savedAt : undefined,
  };
};

export const getConfiguredModels = (
  provider: ProviderConfig | undefined,
  category: ModelCategory,
) => provider?.models.filter((model) => model.categories.includes(category)) || [];

export const getSelectedModel = (
  provider: ProviderConfig | undefined,
  category: ModelCategory,
) => {
  const models = getConfiguredModels(provider, category);
  const selected = provider?.selectedModels[category];
  return selected && models.some((model) => model.id === selected) ? selected : models[0]?.id || '';
};

export const providerSupportsCategory = (
  provider: ProviderConfig | undefined,
  category: ModelCategory,
) => getConfiguredModels(provider, category).length > 0;

/** 地址的协议 + 域名 + 端口，统一小写；格式不对时返回空字符串。 */
export const urlOrigin = (url: string | undefined) => {
  try {
    const origin = new URL(String(url || '').trim()).origin.toLowerCase();
    return origin === 'null' ? '' : origin;
  } catch {
    return '';
  }
};

const uniqueOrigins = (urls: Array<string | undefined>) =>
  [...new Set(urls.map(urlOrigin).filter(Boolean))];

/** 模型有自己的 Key：刚填写的，或网关里已保存的。 */
export const modelHasOwnKey = (model: ProviderModel) =>
  Boolean(model.apiKeyOverride?.trim() || model.apiKeyOverrideHint);

/** 通用 Key 会发往的地址：通用 Base URL，加上没有自己 Key 的模型覆盖的 Base URL。 */
export const providerKeyOrigins = (provider: ProviderConfig) => uniqueOrigins([
  provider.baseUrl,
  ...provider.models
    .filter((model) => !modelHasOwnKey(model))
    .map((model) => model.baseUrlOverride),
]);

/** 模型 Key 会发往的地址。 */
export const modelKeyOrigins = (provider: ProviderConfig, model: ProviderModel) =>
  uniqueOrigins([model.baseUrlOverride?.trim() || provider.baseUrl]);

export const originsAllowed = (required: string[], allowed: string[]) =>
  required.every((origin) => allowed.includes(origin));

/** 已保存的通用 Key 能否继续用：当前所有会用到它的地址都在保存时允许的范围内。 */
export const providerKeyHintUsable = (provider: ProviderConfig) =>
  Boolean(provider.apiKeyHint
    && originsAllowed(providerKeyOrigins(provider), provider.apiKeyHint.origins));

export const modelKeyHintUsable = (provider: ProviderConfig, model: ProviderModel) =>
  Boolean(model.apiKeyOverrideHint
    && originsAllowed(modelKeyOrigins(provider, model), model.apiKeyOverrideHint.origins));

export const isProviderSaved = (provider: ProviderConfig) => Boolean(
  provider.savedAt || provider.apiKey.trim() || provider.apiKeyHint || provider.models.length,
);

export const connectionHasKey = (connection: ResolvedProviderConnection | undefined) =>
  Boolean(connection?.apiKey || connection?.storedKey);

/**
 * Key 的取用顺序：模型刚填写的 Key → 模型已保存的 Key → 通用刚填写的 Key → 通用已保存的 Key。
 * 已保存的 Key 只给出引用，由网关填入。
 */
export const resolveModelConnection = (
  provider: ProviderConfig | undefined,
  category: ModelCategory,
  modelId = getSelectedModel(provider, category),
): ResolvedProviderConnection | undefined => {
  const model = provider?.models.find((item) =>
    item.id === modelId && item.categories.includes(category));
  if (!provider || !model) return undefined;
  const connection = {
    category,
    protocol: provider.protocol,
    baseUrl: model.baseUrlOverride?.trim() || provider.baseUrl.trim(),
    apiKey: '',
    model: model.id,
  };
  const modelKey = model.apiKeyOverride?.trim();
  if (modelKey) return { ...connection, apiKey: modelKey };
  if (model.apiKeyOverrideHint) {
    return { ...connection, storedKey: { providerId: provider.id, modelId: model.id, scope: 'model' } };
  }
  const providerKey = provider.apiKey.trim();
  if (providerKey) return { ...connection, apiKey: providerKey };
  if (provider.apiKeyHint) {
    return { ...connection, storedKey: { providerId: provider.id, scope: 'provider' } };
  }
  return connection;
};

export const invalidateProviderModels = (
  provider: ProviderConfig,
  field: 'protocol' | 'baseUrl' | 'apiKey',
): ProviderConfig => ({
  ...provider,
  models: provider.models.map((model) => {
    const affected = field === 'protocol'
      || (field === 'baseUrl' && !model.baseUrlOverride)
      || (field === 'apiKey' && !modelHasOwnKey(model));
    return affected ? { ...model, verification: { status: 'pending' } } : model;
  }),
});

export const markModelsPending = (provider: ProviderConfig): ProviderConfig => ({
  ...provider,
  models: provider.models.map((model) => ({
    ...model,
    verification: { status: 'pending' },
  })),
});

/**
 * 把一批模型加入或移出某个类型。加入时已有的模型只补上类型，新模型按传入顺序追加；
 * 移出后不再属于任何类型的模型会被删除。原默认模型不在该类型里时，改用该类型的第一个模型。
 */
export const setModelsInCategory = (
  provider: ProviderConfig,
  category: ModelCategory,
  ids: string[],
  included: boolean,
  verification: ProviderVerification = { status: 'pending' },
): ProviderConfig => {
  const targets = new Set(ids.map((id) => id.trim()).filter(Boolean));
  let models: ProviderModel[];
  if (included) {
    const existing = new Set(provider.models.map((model) => model.id));
    models = [
      ...provider.models.map((model) => (targets.has(model.id) && !model.categories.includes(category)
        ? { ...model, categories: [...model.categories, category] }
        : model)),
      ...[...targets]
        .filter((id) => !existing.has(id))
        .map((id) => ({ id, categories: [category], verification: { ...verification } })),
    ];
  } else {
    models = provider.models.flatMap((model) => {
      if (!targets.has(model.id) || !model.categories.includes(category)) return [model];
      const categories = model.categories.filter((item) => item !== category);
      return categories.length ? [{ ...model, categories }] : [];
    });
  }
  const inCategory = models.filter((model) => model.categories.includes(category));
  const current = provider.selectedModels[category];
  const nextSelected = current && inCategory.some((model) => model.id === current) ? current : inCategory[0]?.id;
  const selectedModels = { ...provider.selectedModels };
  if (nextSelected) selectedModels[category] = nextSelected;
  else delete selectedModels[category];
  return { ...provider, models, selectedModels };
};

interface LegacyAssignment {
  modelId: string;
  category: ModelCategory;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  selected: boolean;
}

const legacyAssignments = (provider: Record<string, any>): LegacyAssignment[] => {
  if (provider.connections && typeof provider.connections === 'object') {
    return MODEL_CATEGORIES.flatMap((category) => {
      const connection = provider.connections[category];
      if (!connection || !Array.isArray(connection.models)) return [];
      return connection.models.map((modelId: unknown) => ({
        modelId: String(modelId || '').trim(),
        category,
        protocol: normalizeProtocol(connection.protocol),
        baseUrl: String(connection.baseUrl || '').trim(),
        apiKey: String(connection.apiKey || '').trim(),
        selected: String(connection.selectedModel || '') === String(modelId || ''),
      })).filter((assignment: LegacyAssignment) => Boolean(assignment.modelId));
    });
  }

  const configured = Array.isArray(provider.configuredModels)
    ? provider.configuredModels
    : provider.model
      ? [{ id: provider.model, categories: ['language'] }]
      : [];
  return configured.flatMap((model: Record<string, unknown>) => {
    const categories = normalizeCategories(model.categories || model.category || 'language');
    return categories.map((category) => ({
      modelId: String(model.id || '').trim(),
      category,
      protocol: normalizeProtocol(provider.protocol),
      baseUrl: String(provider.baseUrl || '').trim(),
      apiKey: String(provider.apiKey || '').trim(),
      selected: String(provider.modelSelections?.[category]
        || (category === 'language' ? provider.model : '')) === String(model.id || ''),
    }));
  }).filter((assignment: LegacyAssignment) => Boolean(assignment.modelId));
};

const mostFrequent = <T>(items: T[], keyOf: (item: T) => string) => {
  const counts = new Map<string, { count: number; value: T }>();
  for (const item of items) {
    const key = keyOf(item);
    const current = counts.get(key);
    counts.set(key, { count: (current?.count || 0) + 1, value: current?.value || item });
  }
  return [...counts.values()].sort((left, right) => right.count - left.count)[0]?.value;
};

export const migrateProviderStateV6 = (value: unknown): ProviderStateSnapshot => {
  const legacy = (value && typeof value === 'object' ? value : {}) as Record<string, any>;
  const sourceProviders = Array.isArray(legacy.providers) ? legacy.providers : [];
  const isV6 = sourceProviders.every((provider: Record<string, any>) =>
    Array.isArray(provider?.models) && !provider?.connections);

  if (isV6) {
    const providers = sourceProviders.map(normalizeV6Provider);
    const activeProviderIds = Object.fromEntries(MODEL_CATEGORIES.flatMap((category) => {
      const id = legacy.activeProviderIds?.[category];
      return typeof id === 'string' && providers.some((provider) => provider.id === id)
        ? [[category, id]]
        : [];
    })) as ActiveProviderIds;
    return { providers, activeProviderIds };
  }

  const providers: ProviderConfig[] = [];
  const categoryProviderMap = new Map<string, string>();

  for (const source of sourceProviders) {
    const assignments = legacyAssignments(source);
    const protocols = [...new Set(assignments.map((assignment) => assignment.protocol))];
    const primaryProtocol = mostFrequent(assignments, (assignment) => assignment.protocol)?.protocol;

    for (const protocol of protocols) {
      const group = assignments.filter((assignment) => assignment.protocol === protocol);
      const common = mostFrequent(group, (assignment) => `${assignment.baseUrl}\u0000${assignment.apiKey}`);
      if (!common) continue;
      const ordered = [...group].sort((left, right) => {
        const leftCommon = left.baseUrl === common.baseUrl && left.apiKey === common.apiKey ? 0 : 1;
        const rightCommon = right.baseUrl === common.baseUrl && right.apiKey === common.apiKey ? 0 : 1;
        return leftCommon - rightCommon;
      });
      const modelMap = new Map<string, ProviderModel>();
      const selectedModels: ProviderConfig['selectedModels'] = {};
      for (const assignment of ordered) {
        const existing = modelMap.get(assignment.modelId);
        if (existing) {
          if (!existing.categories.includes(assignment.category)) {
            existing.categories.push(assignment.category);
          }
        } else {
          modelMap.set(assignment.modelId, {
            id: assignment.modelId,
            categories: [assignment.category],
            ...(assignment.baseUrl !== common.baseUrl
              ? { baseUrlOverride: assignment.baseUrl }
              : {}),
            ...(assignment.apiKey !== common.apiKey
              ? { apiKeyOverride: assignment.apiKey }
              : {}),
            verification: { status: 'pending' },
          });
        }
        if (assignment.selected && !selectedModels[assignment.category]) {
          selectedModels[assignment.category] = assignment.modelId;
        }
      }
      for (const category of MODEL_CATEGORIES) {
        if (!selectedModels[category]) {
          selectedModels[category] = [...modelMap.values()]
            .find((model) => model.categories.includes(category))?.id;
        }
      }
      const id = protocol === primaryProtocol
        ? String(source.id || crypto.randomUUID())
        : `${String(source.id || crypto.randomUUID())}-${protocol}`;
      providers.push({
        id,
        name: protocol === primaryProtocol
          ? String(source.name || '未命名厂商')
          : `${String(source.name || '未命名厂商')} · ${protocol}`,
        protocol,
        baseUrl: common.baseUrl,
        apiKey: common.apiKey,
        models: [...modelMap.values()],
        selectedModels,
        savedAt: typeof source.savedAt === 'number' ? source.savedAt : undefined,
      });
      for (const category of MODEL_CATEGORIES) {
        if ([...modelMap.values()].some((model) => model.categories.includes(category))) {
          categoryProviderMap.set(`${String(source.id)}:${category}`, id);
        }
      }
    }
  }

  const oldActiveIds = legacy.activeProviderIds || Object.fromEntries(
    MODEL_CATEGORIES.map((category) => [category, legacy.activeProviderId]),
  );
  const activeProviderIds = Object.fromEntries(MODEL_CATEGORIES.flatMap((category) => {
    const mapped = categoryProviderMap.get(`${String(oldActiveIds?.[category])}:${category}`);
    return mapped ? [[category, mapped]] : [];
  })) as ActiveProviderIds;
  return { providers, activeProviderIds };
};
