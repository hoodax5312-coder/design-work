import { connectionHasKey, resolveModelConnection } from '../lib/providerConnections';
import type { ModelCategory, ProviderConfig, ProviderModelInfo } from '../types/provider';

const request = async <T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };

  if (!response.ok) {
    throw new Error(payload?.error || `请求失败 (${response.status})`);
  }

  return payload as T;
};

const categoryLabels: Record<ModelCategory, string> = {
  language: '文本',
  image: '生图',
  video: '视频',
};

const configPayload = (
  provider: ProviderConfig,
  category: ModelCategory,
  modelId?: string,
) => {
  const connection = resolveModelConnection(provider, category, modelId);
  // 已保存的 Key 不在浏览器里，connection 只带 storedKey 引用，由本机网关补上 Key。
  if (!connection?.baseUrl || !connectionHasKey(connection) || !connection.model) {
    throw new Error(`当前厂商未完成${categoryLabels[category]}模型连接配置`);
  }
  return connection;
};

export const testProviderModel = (
  provider: ProviderConfig,
  category: ModelCategory,
  modelId?: string,
) =>
  request<{
    ok: true;
    latency: number;
    models: string[];
    normalizedBaseUrl: string;
  }>('/api/provider/test', {
    config: configPayload(provider, category, modelId),
  });

/** 用厂商的通用连接读取模型列表；不需要先添加模型，也不发起生成。 */
export const listProviderModels = (
  provider: Pick<ProviderConfig, 'id' | 'protocol' | 'baseUrl' | 'apiKey' | 'apiKeyHint'>,
) => {
  const baseUrl = provider.baseUrl.trim();
  const apiKey = provider.apiKey.trim();
  // 没有新填写的 Key 时，用这个厂商已保存在本机的通用 Key。
  const storedKey = !apiKey && provider.apiKeyHint
    ? { providerId: provider.id, scope: 'provider' as const }
    : undefined;
  if (!baseUrl || (!apiKey && !storedKey)) {
    return Promise.reject(new Error('请先填写通用 Base URL 和 API Key'));
  }
  return request<{
    ok: true;
    latency: number;
    models: ProviderModelInfo[];
    normalizedBaseUrl: string;
  }>('/api/provider/models', {
    config: storedKey
      ? { protocol: provider.protocol, baseUrl, apiKey: '', storedKey }
      : { protocol: provider.protocol, baseUrl, apiKey },
  });
};

export const generateProviderImage = (
  provider: ProviderConfig,
  input: { prompt: string; size: string; quality: string },
  modelId?: string,
  signal?: AbortSignal,
) =>
  request<{ url: string; revisedPrompt?: string }>('/api/provider/image', {
    config: configPayload(provider, 'image', modelId),
    ...input,
  }, signal);

export const generateProviderVideo = (
  provider: ProviderConfig,
  input: { prompt: string; resolution?: string },
  modelId?: string,
  signal?: AbortSignal,
) =>
  request<{ url: string; id?: string }>('/api/provider/video', {
    config: configPayload(provider, 'video', modelId),
    ...input,
  }, signal);

export const generateProviderText = (
  provider: ProviderConfig,
  prompt: string,
  modelId?: string,
  signal?: AbortSignal,
) =>
  request<{ content: string; usage?: unknown }>('/api/provider/chat', {
    config: configPayload(provider, 'language', modelId),
    messages: [{ role: 'user', content: prompt }],
  }, signal);
