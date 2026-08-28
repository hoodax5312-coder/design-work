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

export const resolveModelConnection = (
  provider: ProviderConfig | undefined,
  category: ModelCategory,
  modelId = getSelectedModel(provider, category),
): ResolvedProviderConnection | undefined => {
  const model = provider?.models.find((item) =>
    item.id === modelId && item.categories.includes(category));
  if (!provider || !model) return undefined;
  return {
    category,
    protocol: provider.protocol,
    baseUrl: model.baseUrlOverride?.trim() || provider.baseUrl.trim(),
    apiKey: model.apiKeyOverride?.trim() || provider.apiKey.trim(),
    model: model.id,
  };
};

export const invalidateProviderModels = (
  provider: ProviderConfig,
  field: 'protocol' | 'baseUrl' | 'apiKey',
): ProviderConfig => ({
  ...provider,
  models: provider.models.map((model) => {
    const affected = field === 'protocol'
      || (field === 'baseUrl' && !model.baseUrlOverride)
      || (field === 'apiKey' && !model.apiKeyOverride);
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
