import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ProviderProtocol = 'openai' | 'gemini' | 'anthropic';

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  models: string[];
  enabled: boolean;
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
  removeProvider: (id: string) => void;
}

export const providerDefaults: Record<
  ProviderProtocol,
  Pick<ProviderConfig, 'name' | 'baseUrl' | 'model'>
> = {
  openai: {
    name: 'OpenAI Compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-latest',
  },
};

const initialProvider: ProviderConfig = {
  id: 'default-openai',
  protocol: 'openai',
  apiKey: '',
  models: [],
  enabled: true,
  ...providerDefaults.openai,
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
      setActiveProvider: (id) => set({ activeProviderId: id }),
      removeProvider: (id) =>
        set((state) => {
          const providers = state.providers.filter((item) => item.id !== id);
          return {
            providers,
            activeProviderId:
              state.activeProviderId === id ? providers[0]?.id || '' : state.activeProviderId,
          };
        }),
    }),
    { name: 'mboard-providers' },
  ),
);

export const getActiveProvider = (state: ProviderState) =>
  state.providers.find((provider) => provider.id === state.activeProviderId);
