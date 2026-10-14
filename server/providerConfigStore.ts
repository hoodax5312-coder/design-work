import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteFile } from './atomicFile';
import {
  MODEL_CATEGORIES,
  migrateProviderStateV6,
  modelKeyOrigins,
  originsAllowed,
  providerKeyOrigins,
  providerSupportsCategory,
  urlOrigin,
} from '../src/lib/providerConnections';
import type {
  ActiveProviderIds,
  ModelCategory,
  ProviderConfig,
  ProviderStateSnapshot,
  StoredKeyRef,
} from '../src/types/provider';

const FILE_FORMAT = 'lizuo-provider-config';
const FILE_VERSION = 1;
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;

export type ProviderImportMode = 'replace-matching' | 'add-missing';

export class ProviderConfigError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}

/**
 * API 配置放在系统的应用配置目录，不放“文稿”（可能被 iCloud 同步）也不放项目目录（可能被提交）。
 * 测试用 LIZUO_CONFIG_DIR 指到临时目录。
 */
export const defaultProviderConfigPath = () => {
  const override = process.env.LIZUO_CONFIG_DIR?.trim();
  if (override) return path.join(override, 'providers.json');
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'LIZUO', 'providers.json');
  }
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'LIZUO', 'providers.json');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'lizuo', 'providers.json');
};

const displayPath = (filePath: string) => {
  const home = os.homedir();
  return filePath.startsWith(`${home}${path.sep}`) ? `~${filePath.slice(home.length)}` : filePath;
};

/** Key 至少 16 位时显示前 3 位和后 4 位，太短的 Key 不露出任何字符。 */
export const maskKey = (key: string) => {
  const trimmed = key.trim();
  return trimmed.length >= 16 ? `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}` : '••••••';
};

const emptyState = (): ProviderStateSnapshot => ({ providers: [], activeProviderIds: {} });

const isCategory = (value: unknown): value is ModelCategory =>
  MODEL_CATEGORIES.includes(value as ModelCategory);

/** 去掉指向不存在厂商、或厂商已不支持该类型的默认厂商。 */
const cleanActiveIds = (
  providers: ProviderConfig[],
  activeProviderIds: ActiveProviderIds,
): ActiveProviderIds => Object.fromEntries(MODEL_CATEGORIES.flatMap((category) => {
  const id = activeProviderIds[category];
  const provider = providers.find((item) => item.id === id);
  return id && providerSupportsCategory(provider, category) ? [[category, id]] : [];
})) as ActiveProviderIds;

/** 浏览器只拿到掩码和这把 Key 允许发往的地址，完整的 Key 只留在网关。 */
export const toPublicSnapshot = (state: ProviderStateSnapshot): ProviderStateSnapshot => ({
  activeProviderIds: state.activeProviderIds,
  providers: state.providers.map((provider) => ({
    ...provider,
    apiKey: '',
    ...(provider.apiKey
      ? { apiKeyHint: { masked: maskKey(provider.apiKey), origins: providerKeyOrigins(provider) } }
      : {}),
    models: provider.models.map((model) => {
      if (!model.apiKeyOverride) return model;
      const { apiKeyOverride, ...rest } = model;
      return {
        ...rest,
        apiKeyOverrideHint: { masked: maskKey(apiKeyOverride), origins: modelKeyOrigins(provider, model) },
      };
    }),
  })),
});

const domainChangedMessage = (modelId?: string) => modelId
  ? `模型 ${modelId} 的 Base URL 域名（host）与保存时不同，已保存的 API Key 不会发送到新地址，请重新填写这个模型的 API Key`
  : 'Base URL 的域名（host）与保存时不同，已保存的 API Key 不会发送到新地址，请重新填写通用 API Key';

/**
 * 保存时 Key 留空表示沿用已保存的 Key。模型是否沿用看提交里有没有 apiKeyOverrideHint（只看有没有，不信任其内容）；
 * 沿用的前提是这把 Key 要发往的地址没有超出保存时的范围。
 */
const mergeProvider = (input: unknown, stored: ProviderConfig | undefined): ProviderConfig => {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  if (!Array.isArray(raw.models)) throw new ProviderConfigError('厂商配置格式不正确');
  const incoming = migrateProviderStateV6({ providers: [raw] }).providers[0];
  const keepModelKey = new Set((raw.models as Array<Record<string, any>>)
    .filter((model) => model?.apiKeyOverrideHint)
    .map((model) => String(model.id || '').trim()));

  const models = incoming.models.map((model) => {
    if (model.apiKeyOverride || !keepModelKey.has(model.id)) return model;
    const previous = stored?.models.find((item) => item.id === model.id);
    if (!stored || !previous?.apiKeyOverride) {
      throw new ProviderConfigError(`模型 ${model.id} 没有已保存的 API Key，请重新填写这个模型的 API Key`);
    }
    if (!originsAllowed(modelKeyOrigins(incoming, model), modelKeyOrigins(stored, previous))) {
      throw new ProviderConfigError(domainChangedMessage(model.id));
    }
    return { ...model, apiKeyOverride: previous.apiKeyOverride };
  });

  const merged = { ...incoming, models };
  if (merged.apiKey || !stored?.apiKey) return merged;
  if (!originsAllowed(providerKeyOrigins(merged), providerKeyOrigins(stored))) {
    throw new ProviderConfigError(domainChangedMessage());
  }
  return { ...merged, apiKey: stored.apiKey };
};

export const createProviderConfigStore = (filePath: string) => {
  const shownPath = displayPath(filePath);
  let queue: Promise<unknown> = Promise.resolve();

  /** 读改写串行执行，避免两次保存交错时后一次覆盖前一次。 */
  const exclusive = <T>(task: () => Promise<T>) => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  const ioError = (error: unknown, action: '读取' | '写入') => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM') {
      return new ProviderConfigError(
        `没有权限${action} API 配置：${shownPath}。请检查这个文件和所在文件夹的读写权限。`,
        500,
      );
    }
    return new ProviderConfigError(
      `${action} API 配置失败${code ? `（${code}）` : ''}：${shownPath}`,
      500,
    );
  };

  const corruptError = (reason: string) => new ProviderConfigError(
    `API 配置文件${reason}，为避免覆盖，栗作没有改动它：${shownPath}。请修复或删除这个文件后重试；删除后可以重新添加厂商，或导入之前导出的配置。`,
    500,
  );

  const readState = async (): Promise<ProviderStateSnapshot> => {
    let text: string;
    try {
      text = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyState();
      throw ioError(error, '读取');
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      throw corruptError('已损坏（不是有效的 JSON）');
    }
    if (!data || typeof data !== 'object' || data.format !== FILE_FORMAT || !Array.isArray(data.providers)) {
      throw corruptError('格式不正确');
    }
    if (typeof data.version !== 'number' || data.version > FILE_VERSION) {
      throw corruptError('版本比当前栗作新');
    }
    const state = migrateProviderStateV6({
      providers: data.providers,
      activeProviderIds: data.activeProviderIds,
    });
    return { ...state, activeProviderIds: cleanActiveIds(state.providers, state.activeProviderIds) };
  };

  const writeState = async (state: ProviderStateSnapshot) => {
    const payload = {
      format: FILE_FORMAT,
      version: FILE_VERSION,
      savedAt: new Date().toISOString(),
      activeProviderIds: state.activeProviderIds,
      providers: state.providers,
    };
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true, mode: DIRECTORY_MODE });
      await fs.chmod(path.dirname(filePath), DIRECTORY_MODE);
      await atomicWriteFile(filePath, JSON.stringify(payload, null, 2), { mode: FILE_MODE });
    } catch (error) {
      throw ioError(error, '写入');
    }
  };

  const update = (change: (state: ProviderStateSnapshot) => ProviderStateSnapshot) =>
    exclusive(async () => {
      const next = change(await readState());
      const state = { ...next, activeProviderIds: cleanActiveIds(next.providers, next.activeProviderIds) };
      await writeState(state);
      return toPublicSnapshot(state);
    });

  const findProvider = (state: ProviderStateSnapshot, id: string) =>
    state.providers.find((provider) => provider.id === id);

  return {
    filePath,

    read: () => exclusive(async () => toPublicSnapshot(await readState())),

    /** 完整配置，含 Key，只给导出用。 */
    exportState: () => exclusive(readState),

    saveProvider: (id: string, input: unknown) => update((state) => {
      const rawId = String((input as Record<string, unknown> | undefined)?.id || '').trim();
      if (!id || rawId !== id) throw new ProviderConfigError('厂商 ID 与请求地址不一致');
      const provider = mergeProvider(input, findProvider(state, id));
      return {
        ...state,
        providers: findProvider(state, id)
          ? state.providers.map((item) => (item.id === id ? provider : item))
          : [...state.providers, provider],
      };
    }),

    removeProvider: (id: string) => update((state) => ({
      ...state,
      providers: state.providers.filter((provider) => provider.id !== id),
    })),

    setActiveProvider: (category: unknown, providerId: unknown) => update((state) => {
      if (!isCategory(category)) throw new ProviderConfigError('不支持的模型类型');
      const activeProviderIds = { ...state.activeProviderIds };
      if (typeof providerId === 'string' && providerId) activeProviderIds[category] = providerId;
      else delete activeProviderIds[category];
      return { ...state, activeProviderIds };
    }),

    setSelectedModel: (providerId: unknown, category: unknown, modelId: unknown) => update((state) => {
      if (!isCategory(category)) throw new ProviderConfigError('不支持的模型类型');
      return {
        ...state,
        providers: state.providers.map((provider) => {
          if (provider.id !== providerId) return provider;
          const valid = provider.models.some((model) =>
            model.id === modelId && model.categories.includes(category));
          return valid
            ? { ...provider, selectedModels: { ...provider.selectedModels, [category]: modelId as string } }
            : provider;
        }),
      };
    }),

    /**
     * replace-matching：同 ID 的厂商被替换，导入的默认厂商覆盖现有设置（用户主动导入文件）。
     * add-missing：只补上没有的厂商和没设置的默认厂商（旧浏览器配置自动迁移）。
     */
    importProviders: (input: unknown, mode: unknown) => update((state) => {
      if (mode !== 'replace-matching' && mode !== 'add-missing') {
        throw new ProviderConfigError('不支持的导入方式');
      }
      const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
      if (!Array.isArray(raw.providers)) throw new ProviderConfigError('导入的配置缺少厂商列表');
      const imported = migrateProviderStateV6({
        providers: raw.providers,
        activeProviderIds: raw.activeProviderIds,
      });
      if (mode === 'add-missing') {
        const existing = new Set(state.providers.map((provider) => provider.id));
        return {
          providers: [
            ...state.providers,
            ...imported.providers.filter((provider) => !existing.has(provider.id)),
          ],
          activeProviderIds: { ...imported.activeProviderIds, ...state.activeProviderIds },
        };
      }
      const importedIds = new Set(imported.providers.map((provider) => provider.id));
      return {
        providers: [
          ...state.providers.map((provider) =>
            importedIds.has(provider.id) ? findProvider(imported, provider.id)! : provider),
          ...imported.providers.filter((provider) => !findProvider(state, provider.id)),
        ],
        activeProviderIds: { ...state.activeProviderIds, ...imported.activeProviderIds },
      };
    }),

    /** 请求没带 Key 时按引用取出已保存的 Key；只发往保存时允许的地址。 */
    resolveStoredKey: async (ref: unknown, requestBaseUrl: string) => {
      const target = (ref && typeof ref === 'object' ? ref : {}) as Partial<StoredKeyRef>;
      const state = await exclusive(readState);
      const provider = typeof target.providerId === 'string'
        ? findProvider(state, target.providerId)
        : undefined;
      const model = target.scope === 'model'
        ? provider?.models.find((item) => item.id === target.modelId)
        : undefined;
      const key = target.scope === 'model' ? model?.apiKeyOverride : target.scope === 'provider' ? provider?.apiKey : '';
      if (!provider || !key) {
        throw new ProviderConfigError('已保存的 API Key 不存在，请在“API 与模型”中重新填写并保存');
      }
      const origin = urlOrigin(requestBaseUrl);
      if (!origin) {
        throw new ProviderConfigError('Base URL 格式不正确，请填写完整地址，例如 https://api.openai.com/v1');
      }
      const allowed = model ? modelKeyOrigins(provider, model) : providerKeyOrigins(provider);
      if (!allowed.includes(origin)) throw new ProviderConfigError(domainChangedMessage(model?.id));
      return key;
    },
  };
};

export type ProviderConfigStore = ReturnType<typeof createProviderConfigStore>;
