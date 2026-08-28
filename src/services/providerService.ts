import { resolveModelConnection } from '../lib/providerConnections';
import type { ModelCategory, ProviderConfig } from '../types/provider';

const request = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  if (!connection?.baseUrl || !connection.apiKey || !connection.model) {
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

export const generateProviderImage = (
  provider: ProviderConfig,
  input: { prompt: string; size: string; quality: string },
  modelId?: string,
) =>
  request<{ url: string; revisedPrompt?: string }>('/api/provider/image', {
    config: configPayload(provider, 'image', modelId),
    ...input,
  });

export const generateProviderVideo = (
  provider: ProviderConfig,
  input: { prompt: string; resolution?: string },
  modelId?: string,
) =>
  request<{ url: string; id?: string }>('/api/provider/video', {
    config: configPayload(provider, 'video', modelId),
    ...input,
  });

export const generateProviderText = (
  provider: ProviderConfig,
  prompt: string,
  modelId?: string,
) =>
  request<{ content: string; usage?: unknown }>('/api/provider/chat', {
    config: configPayload(provider, 'language', modelId),
    messages: [{ role: 'user', content: prompt }],
  });
