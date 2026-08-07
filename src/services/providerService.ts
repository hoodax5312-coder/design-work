import {
  type ProviderConfig,
} from '../stores/useProviderStore';

const request = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `请求失败 (${response.status})`);
  }

  return payload as T;
};

const configPayload = (provider: ProviderConfig) => ({
  protocol: provider.protocol,
  baseUrl: provider.baseUrl,
  apiKey: provider.apiKey,
  model: provider.model
    || provider.configuredModels?.[0]?.id
    || provider.models?.[0]
    || '',
});

export const testProvider = (provider: ProviderConfig) =>
  request<{
    ok: true;
    latency: number;
    models: string[];
    chatVerified: boolean;
    normalizedBaseUrl: string;
  }>('/api/provider/test', {
    config: configPayload(provider),
  });

export const generateProviderImage = (
  provider: ProviderConfig,
  input: { prompt: string; size: string; quality: string },
) =>
  request<{ url: string; revisedPrompt?: string }>('/api/provider/image', {
    config: configPayload(provider),
    ...input,
  });

export const generateProviderVideo = (
  provider: ProviderConfig,
  input: { prompt: string; resolution?: string },
) =>
  request<{ url: string; id?: string }>('/api/provider/video', {
    config: configPayload(provider),
    ...input,
  });

export const generateProviderText = (
  provider: ProviderConfig,
  prompt: string,
) =>
  request<{ content: string; usage?: unknown }>('/api/provider/chat', {
    config: configPayload(provider),
    messages: [{ role: 'user', content: prompt }],
  });
