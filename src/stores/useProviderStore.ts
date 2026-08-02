import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ProviderProtocol = 'responses' | 'chat-completions' | 'anthropic-messages';
export type ModelCategory = 'language' | 'image' | 'video';

export type ModelSelections = Partial<Record<ModelCategory, string>>;

export interface ConfiguredModel {
  id: string;
  category?: ModelCategory;
  categories?: ModelCategory[];
}

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  models: string[];
  configuredModels?: ConfiguredModel[];
  modelSelections?: ModelSelections;
  enabled: boolean;
  savedAt?: number;
  health?: {
    status: 'healthy' | 'unhealthy';
    latency: number;
    checkedAt: number;
    error?: string;
  };
}

interface ProviderState {
  providers: ProviderConfig[];
  activeProviderId: string;
  upsertProvider: (provider: ProviderConfig) => void;
  setActiveProvider: (id: string) => void;
  setConfiguredModels: (providerId: string, models: ConfiguredModel[]) => void;
  setModelSelection: (providerId: string, category: ModelCategory, model: string) => void;
  removeProvider: (id: string) => void;
}

const MODEL_CATEGORIES: ModelCategory[] = ['language', 'image', 'video'];

export const getModelCategories = (model: ConfiguredModel): ModelCategory[] => {
  const categories = (model.categories || []).filter(
    (category): category is ModelCategory => MODEL_CATEGORIES.includes(category),
  );
  if (categories.length) return [...new Set(categories)];
  return model.category ? [model.category] : [];
};

export const modelSupportsCategory = (
  model: ConfiguredModel,
  category: ModelCategory,
) => getModelCategories(model).includes(category);

export const providerDefaults: Record<
  ProviderProtocol,
  Pick<ProviderConfig, 'name' | 'baseUrl' | 'model'>
> = {
  responses: {
    name: 'OpenAI Responses',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  'chat-completions': {
    name: 'OpenAI Chat Completions',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  'anthropic-messages': {
    name: 'Anthropic Messages',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-latest',
  },
};

const initialProvider: ProviderConfig = {
  id: 'default-responses',
  protocol: 'responses',
  apiKey: '',
  models: [],
  enabled: true,
  ...providerDefaults.responses,
};

export const useProviderStore = create<ProviderState>()(
  persist(
    (set) => ({
      providers: [initialProvider],
      activeProviderId: initialProvider.id,
      upsertProvider: (provider) =>
        set((state) => ({
          providers: state.providers.some((item) => item.id === provider.id)
            ? state.providers.map((item) => (item.id === provider.id ? provider : item))
            : [...state.providers, provider],
        })),
      setActiveProvider: (id) =>
        set((state) => ({
          activeProviderId: id,
          providers: state.providers.map((provider) => ({
            ...provider,
            enabled: provider.id === id,
          })),
        })),
      setConfiguredModels: (providerId, models) =>
        set((state) => ({
          providers: state.providers.map((provider) => {
            if (provider.id !== providerId) return provider;
            const normalizedModels = models.map((model) => {
              const categories = getModelCategories(model);
              return {
                ...model,
                category: categories[0],
                categories,
              };
            });
            const languageModel = normalizedModels.find((item) =>
              modelSupportsCategory(item, 'language'))?.id || '';
            const modelSelections = Object.fromEntries(
              Object.entries(provider.modelSelections || {}).filter(([category, model]) =>
                normalizedModels.some((item) =>
                  item.id === model
                  && modelSupportsCategory(item, category as ModelCategory)),
              ),
            ) as ModelSelections;
            return {
              ...provider,
              model: normalizedModels.some((item) =>
                item.id === provider.model && modelSupportsCategory(item, 'language'))
                ? provider.model
                : languageModel,
              configuredModels: normalizedModels,
              modelSelections,
            };
          }),
        })),
      setModelSelection: (providerId, category, model) =>
        set((state) => ({
          providers: state.providers.map((provider) =>
            provider.id === providerId
              ? {
                  ...provider,
                  // Keep legacy consumers on the selected language model until they migrate.
                  model: category === 'language' ? model : provider.model,
                  modelSelections: { ...provider.modelSelections, [category]: model },
                }
              : provider,
          ),
        })),
      removeProvider: (id) =>
        set((state) => {
          const providers = state.providers.filter((item) => item.id !== id);
          const activeProviderId =
            state.activeProviderId === id ? providers[0]?.id || '' : state.activeProviderId;
          return {
            providers: providers.map((provider) => ({
              ...provider,
              enabled: provider.id === activeProviderId,
            })),
            activeProviderId,
          };
        }),
    }),
    {
      name: 'mboard-providers',
      version: 4,
      migrate: (persistedState) => {
        const state = persistedState as Partial<ProviderState>;
        const protocolMap: Record<string, ProviderProtocol> = {
          openai: 'chat-completions',
          gemini: 'chat-completions',
          anthropic: 'anthropic-messages',
        };
        const providers = (state.providers || []).map((provider) => ({
          ...provider,
          protocol: protocolMap[String(provider.protocol)] || provider.protocol,
          configuredModels: provider.configuredModels?.map((model) => {
            const categories = getModelCategories(model);
            return { ...model, category: categories[0], categories };
          }),
        })) as ProviderConfig[];
        const activeProviderId = state.activeProviderId || providers[0]?.id || '';
        return {
          ...state,
          activeProviderId,
          providers: providers.map((provider) => ({
            ...provider,
            enabled: provider.id === activeProviderId,
          })) as ProviderConfig[],
        };
      },
    },
  ),
);

export const getActiveProvider = (state: ProviderState) =>
  state.providers.find((provider) => provider.id === state.activeProviderId);

export const getSelectedModel = (
  provider: ProviderConfig | undefined,
  category: ModelCategory,
) => {
  if (!provider) return '';
  const configuredModels = getConfiguredModels(provider).filter((model) =>
    modelSupportsCategory(model, category));
  const selectedModel = provider.modelSelections?.[category];
  if (selectedModel && configuredModels.some((model) => model.id === selectedModel)) {
    return selectedModel;
  }
  if (
    category === 'language'
    && provider.model
    && configuredModels.some((model) => model.id === provider.model)
  ) {
    return provider.model;
  }
  return configuredModels[0]?.id || '';
};

export const getConfiguredModels = (provider: ProviderConfig | undefined): ConfiguredModel[] => {
  if (!provider) return [];
  if (provider.configuredModels?.length) return provider.configuredModels;
  return provider.model
    ? [{ id: provider.model, category: 'language', categories: ['language'] }]
    : [];
};
