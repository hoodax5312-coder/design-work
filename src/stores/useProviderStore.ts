import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { migrateProviderStateV6, providerSupportsCategory } from '../lib/providerConnections';
import type {
  ActiveProviderIds,
  ModelCategory,
  ProviderConfig,
  ProviderProtocol,
  ProviderStateSnapshot,
} from '../types/provider';

export type {
  ActiveProviderIds,
  ModelCategory,
  ProviderConfig,
  ProviderModel,
  ProviderProtocol,
} from '../types/provider';
export {
  getConfiguredModels,
  getSelectedModel,
  providerSupportsCategory,
  resolveModelConnection,
} from '../lib/providerConnections';

export const providerDefaults: Record<
  ProviderProtocol,
  { name: string; baseUrl: string; selectedModel: string }
> = {
  responses: {
    name: 'OpenAI Responses',
    baseUrl: 'https://api.openai.com/v1',
    selectedModel: 'gpt-4o-mini',
  },
  'chat-completions': {
    name: 'OpenAI Chat Completions',
    baseUrl: 'https://api.openai.com/v1',
    selectedModel: 'gpt-4o-mini',
  },
  'anthropic-messages': {
    name: 'Anthropic Messages',
    baseUrl: 'https://api.anthropic.com/v1',
    selectedModel: 'claude-3-5-sonnet-latest',
  },
};

const initialProvider: ProviderConfig = {
  id: 'default-responses',
  name: providerDefaults.responses.name,
  protocol: 'responses',
  baseUrl: providerDefaults.responses.baseUrl,
  apiKey: '',
  models: [],
  selectedModels: {},
};

export interface ProviderState extends ProviderStateSnapshot {
  upsertProvider: (provider: ProviderConfig) => void;
  replaceProviders: (snapshot: ProviderStateSnapshot) => void;
  setActiveProvider: (category: ModelCategory, id: string) => void;
  setSelectedModel: (providerId: string, category: ModelCategory, model: string) => void;
  removeProvider: (id: string) => void;
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set) => ({
      providers: [initialProvider],
      activeProviderIds: {},
      upsertProvider: (provider) => set((state) => ({
        providers: state.providers.some((item) => item.id === provider.id)
          ? state.providers.map((item) => (item.id === provider.id ? provider : item))
          : [...state.providers, provider],
      })),
      replaceProviders: (snapshot) => set(snapshot),
      setActiveProvider: (category, id) => set((state) => ({
        activeProviderIds: {
          ...state.activeProviderIds,
          [category]: state.providers.some(
            (provider) => provider.id === id && providerSupportsCategory(provider, category),
          ) ? id : undefined,
        },
      })),
      setSelectedModel: (providerId, category, model) => set((state) => ({
        providers: state.providers.map((provider) => {
          if (provider.id !== providerId) return provider;
          const valid = provider.models.some((item) =>
            item.id === model && item.categories.includes(category));
          return valid
            ? { ...provider, selectedModels: { ...provider.selectedModels, [category]: model } }
            : provider;
        }),
      })),
      removeProvider: (id) => set((state) => ({
        providers: state.providers.filter((provider) => provider.id !== id),
        activeProviderIds: Object.fromEntries(
          Object.entries(state.activeProviderIds).filter(([, providerId]) => providerId !== id),
        ) as ActiveProviderIds,
      })),
    }),
    {
      name: 'design-work-providers',
      version: 6,
      migrate: (persistedState) => migrateProviderStateV6(persistedState),
    },
  ),
);

export const getActiveProviderForCategory = (
  state: ProviderState,
  category: ModelCategory,
) => state.providers.find((provider) => provider.id === state.activeProviderIds[category]);
