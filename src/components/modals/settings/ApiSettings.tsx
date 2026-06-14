import { useEffect, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Loader2, Plus, Server, Trash2 } from 'lucide-react';
import { testProvider } from '../../../services/providerService';
import { normalizeProviderBaseUrl } from '../../../lib/providerConfig';
import {
  providerDefaults,
  useProviderStore,
  type ProviderConfig,
  type ProviderProtocol,
} from '../../../stores/useProviderStore';

export function ApiSettings() {
  const {
    providers,
    activeProviderId,
    setActiveProvider,
    upsertProvider,
    removeProvider,
  } = useProviderStore();
  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === activeProviderId) || providers[0],
    [activeProviderId, providers],
  );
  const [showKey, setShowKey] = useState(false);
  const [draft, setDraft] = useState<ProviderConfig | null>(activeProvider || null);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setDraft(
      useProviderStore.getState().providers.find((provider) => provider.id === activeProviderId) || null,
    );
    setMessage(null);
  }, [activeProviderId]);

  const createProvider = () => {
    const defaults = providerDefaults.openai;
    const provider: ProviderConfig = {
      id: crypto.randomUUID(),
      protocol: 'openai',
      apiKey: '',
      models: [],
      enabled: true,
      ...defaults,
    };
    upsertProvider(provider);
    setActiveProvider(provider.id);
  };

  const changeProtocol = (protocol: ProviderProtocol) => {
    if (!draft) return;
    setDraft({ ...draft, protocol, ...providerDefaults[protocol], models: [], health: undefined });
  };

  const save = () => {
    if (!draft) return;
    const updated = {
      ...draft,
      baseUrl: normalizeProviderBaseUrl(draft.protocol, draft.baseUrl),
    };
    setDraft(updated);
    upsertProvider(updated);
    setMessage({ type: 'success', text: 'Provider 配置已保存到本机' });
  };

  const test = async () => {
    if (!draft) return;
    setTesting(true);
    setMessage(null);
    const startedAt = Date.now();

    try {
      const result = await testProvider(draft);
      const updated: ProviderConfig = {
        ...draft,
        baseUrl: result.normalizedBaseUrl,
        models: result.models,
        health: {
          status: 'healthy',
          latency: result.latency,
          checkedAt: Date.now(),
        },
      };
      setDraft(updated);
      upsertProvider(updated);
      setMessage({
        type: 'success',
        text: `配置验证通过：模型列表与对话接口均可用，延迟 ${result.latency}ms，发现 ${result.models.length} 个模型`,
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : '连接失败';
      const updated: ProviderConfig = {
        ...draft,
        health: {
          status: 'unhealthy',
          latency: Date.now() - startedAt,
          checkedAt: Date.now(),
          error: text,
        },
      };
      setDraft(updated);
      upsertProvider(updated);
      setMessage({ type: 'error', text });
    } finally {
      setTesting(false);
    }
  };

  if (!draft) {
    return (
      <button
        onClick={createProvider}
        className="flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white"
      >
        <Plus size={16} />
        添加 Provider
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <select
          value={activeProviderId}
          onChange={(event) => setActiveProvider(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
        <button
          onClick={createProvider}
          title="添加 Provider"
          className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700"
        >
          <Plus size={17} />
        </button>
        <button
          onClick={() => removeProvider(draft.id)}
          title="删除 Provider"
          className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Server size={16} /> 模型供应商
          </h4>
          {draft.health && (
            <span className={draft.health.status === 'healthy' ? 'text-xs text-emerald-600' : 'text-xs text-red-600'}>
              {draft.health.status === 'healthy' ? `可用 · ${draft.health.latency}ms` : '连接异常'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="text-xs font-medium text-slate-500">名称</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium text-slate-500">协议</span>
            <select
              value={draft.protocol}
              onChange={(event) => changeProtocol(event.target.value as ProviderProtocol)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="openai">OpenAI Compatible</option>
              <option value="gemini">Google Gemini</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
        </div>

        <div className="space-y-4 rounded-lg bg-slate-50 p-4 dark:bg-zinc-800/50">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Base URL
            </label>
            <input
              type="text"
              value={draft.baseUrl}
              onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {draft.protocol === 'openai' && (
              <p className="text-xs leading-5 text-slate-400">
                填写域名或 API 根地址均可，纯域名会自动补全为 /v1。
                请求将发送到 /v1/models 和 /v1/chat/completions。
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={draft.apiKey}
                onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
                placeholder="sk-..."
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              模型 ID
            </label>
            <input
              list={`models-${draft.id}`}
              value={draft.model}
              onChange={(event) => setDraft({ ...draft, model: event.target.value })}
              placeholder="gpt-4o-mini"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <datalist id={`models-${draft.id}`}>
              {draft.models.map((model) => <option key={model} value={model} />)}
            </datalist>
          </div>
        </div>
      </div>

      {message && (
        <div className={message.type === 'success' ? 'text-sm text-emerald-600' : 'text-sm text-red-600'}>
          {message.text}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={test}
          disabled={testing}
          className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
        >
          {testing ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          验证完整配置
        </button>
        <button
          onClick={save}
          className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950"
        >
          保存 Provider
        </button>
      </div>
    </div>
  );
}
