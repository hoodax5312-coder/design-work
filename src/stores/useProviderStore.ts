import { create } from 'zustand';
import {
  isProviderSaved,
  migrateProviderStateV6,
  providerSupportsCategory,
} from '../lib/providerConnections';
import {
  providerConfigService,
  type ProviderConfigExport,
  type ProviderImportMode,
} from '../services/providerConfigService';
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

/** 旧版本把配置（含 Key）存在浏览器 localStorage 的这个键里。 */
const LEGACY_STORAGE_KEY = 'design-work-providers';

export type ProviderLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProviderState extends ProviderStateSnapshot {
  status: ProviderLoadStatus;
  /** 首次读取失败的原因；读取成功前设置页不渲染，避免用空列表覆盖磁盘上的配置。 */
  error: string | null;
  /** 后台保存（切换默认厂商、选择模型、删除）失败或旧配置迁移失败的提示。 */
  syncError: string | null;
  load: () => Promise<void>;
  clearSyncError: () => void;
  saveProvider: (provider: ProviderConfig) => Promise<void>;
  importProviders: (snapshot: ProviderStateSnapshot, mode: ProviderImportMode) => Promise<void>;
  exportProviders: () => Promise<ProviderConfigExport>;
  setActiveProvider: (category: ModelCategory, id: string) => void;
  setSelectedModel: (providerId: string, category: ModelCategory, model: string) => void;
  removeProvider: (id: string) => void;
}

type LocalChange = (snapshot: ProviderStateSnapshot) => ProviderStateSnapshot;

const errorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : String(error || '未知错误');

export const useProviderStore = create<ProviderState>()((set, get) => {
  // 写入按顺序发给网关；每次成功都以网关返回的配置为准，再叠上还没完成的本地改动。
  let queue: Promise<unknown> = Promise.resolve();
  const pending: { change?: LocalChange }[] = [];
  let loading: Promise<void> | null = null;

  const snapshotOf = (state: ProviderStateSnapshot): ProviderStateSnapshot => ({
    providers: state.providers,
    activeProviderIds: state.activeProviderIds,
  });

  // 网关最后一次确认保存的配置；写入失败时界面退回到它，不停留在没保存成功的乐观状态。
  let confirmed: ProviderStateSnapshot = { providers: [], activeProviderIds: {} };
  const withPending = (snapshot: ProviderStateSnapshot) => pending.reduce<ProviderStateSnapshot>(
    (current, item) => (item.change ? item.change(current) : current),
    snapshot,
  );

  const enqueue = <T extends ProviderStateSnapshot>(send: () => Promise<T>, change?: LocalChange) => {
    const entry = { change };
    pending.push(entry);
    if (change) set((state) => change(snapshotOf(state)));
    const settle = () => pending.splice(pending.indexOf(entry), 1);
    const run = queue.then(send).then(
      (result) => {
        settle();
        confirmed = snapshotOf(result);
        set(withPending(confirmed));
        return result;
      },
      (error: unknown) => {
        settle();
        if (change) set(withPending(confirmed));
        throw error;
      },
    );
    queue = run.catch(() => undefined);
    return run;
  };

  // 乐观更新失败时提示原因，并重新读取网关里的配置，界面回到实际保存的状态。
  const optimistic = (send: () => Promise<ProviderStateSnapshot>, change: LocalChange) => {
    void enqueue(send, change).catch((error: unknown) => {
      set({ syncError: `API 配置没有保存：${errorMessage(error)}` });
      void enqueue(providerConfigService.read).catch(() => undefined);
    });
  };

  const migrateLegacyStorage = async () => {
    const storage = typeof localStorage === 'undefined' ? undefined : localStorage;
    const raw = storage?.getItem(LEGACY_STORAGE_KEY);
    if (!storage || !raw) return;
    try {
      const legacy = migrateProviderStateV6((JSON.parse(raw) as { state?: unknown })?.state);
      const providers = legacy.providers.filter(isProviderSaved);
      if (providers.length) {
        await providerConfigService.importProviders(
          { providers, activeProviderIds: legacy.activeProviderIds },
          'add-missing',
        );
      }
      storage.removeItem(LEGACY_STORAGE_KEY);
    } catch (error) {
      // 迁移失败时保留浏览器里的旧配置，下次启动再试。
      set({ syncError: `浏览器里旧的 API 配置没有迁移成功，已原样保留：${errorMessage(error)}` });
    }
  };

  return {
    providers: [],
    activeProviderIds: {},
    status: 'idle',
    error: null,
    syncError: null,

    load: () => {
      if (loading) return loading;
      if (get().status !== 'ready') set({ status: 'loading', error: null });
      loading = enqueue(async () => {
        await migrateLegacyStorage();
        return providerConfigService.read();
      }).then(
        () => set({ status: 'ready', error: null }),
        (error: unknown) => {
          if (get().status === 'ready') set({ syncError: errorMessage(error) });
          else set({ status: 'error', error: errorMessage(error) });
        },
      ).finally(() => {
        loading = null;
      });
      return loading;
    },

    clearSyncError: () => set({ syncError: null }),

    saveProvider: async (provider) => {
      await enqueue(() => providerConfigService.saveProvider(provider));
    },

    importProviders: async (snapshot, mode) => {
      await enqueue(() => providerConfigService.importProviders(snapshot, mode));
    },

    exportProviders: () => providerConfigService.exportProviders(),

    setActiveProvider: (category, id) => optimistic(
      () => providerConfigService.setActiveProvider(category, id),
      (state) => ({
        ...state,
        activeProviderIds: {
          ...state.activeProviderIds,
          [category]: state.providers.some(
            (provider) => provider.id === id && providerSupportsCategory(provider, category),
          ) ? id : undefined,
        },
      }),
    ),

    setSelectedModel: (providerId, category, model) => optimistic(
      () => providerConfigService.setSelectedModel(providerId, category, model),
      (state) => ({
        ...state,
        providers: state.providers.map((provider) => {
          if (provider.id !== providerId) return provider;
          const valid = provider.models.some((item) =>
            item.id === model && item.categories.includes(category));
          return valid
            ? { ...provider, selectedModels: { ...provider.selectedModels, [category]: model } }
            : provider;
        }),
      }),
    ),

    removeProvider: (id) => optimistic(
      () => providerConfigService.removeProvider(id),
      (state) => ({
        providers: state.providers.filter((provider) => provider.id !== id),
        activeProviderIds: Object.fromEntries(
          Object.entries(state.activeProviderIds).filter(([, providerId]) => providerId !== id),
        ) as ActiveProviderIds,
      }),
    ),
  };
});

export const getActiveProviderForCategory = (
  state: ProviderState,
  category: ModelCategory,
) => state.providers.find((provider) => provider.id === state.activeProviderIds[category]);
