import type { ChatMessage } from '../stores/useChatStore';
import type { ProviderConfig } from '../stores/useProviderStore';

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
  model: provider.model,
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

export const sendChat = (
  provider: ProviderConfig,
  messages: ChatMessage[],
  systemPrompt?: string,
) =>
  request<{ content: string; usage?: unknown }>('/api/provider/chat', {
    config: configPayload(provider),
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages
        .filter((message) => !message.error)
        .map(({ role, content }) => ({ role, content })),
    ],
  });

export const generateProviderImage = (
  provider: ProviderConfig,
  input: { prompt: string; size: string; quality: string },
) =>
  request<{ url: string; revisedPrompt?: string }>('/api/provider/image', {
    config: configPayload(provider),
    ...input,
  });
