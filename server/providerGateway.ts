import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

export type ProviderProtocol = 'openai' | 'gemini' | 'anthropic';

export interface ProviderRequestConfig {
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const withoutTrailingSlash = (value: string) => value.trim().replace(/\/+$/, '');

export const normalizeOpenAiBaseUrl = (value: string) => {
  const normalized = withoutTrailingSlash(value);
  if (!normalized) return normalized;

  try {
    const url = new URL(normalized);
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/v1';
      return withoutTrailingSlash(url.toString());
    }
  } catch {
    return normalized;
  }

  return normalized;
};

const defaultBaseUrl = (protocol: ProviderProtocol) => {
  if (protocol === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta';
  if (protocol === 'anthropic') return 'https://api.anthropic.com/v1';
  return 'https://api.openai.com/v1';
};

const normalizeConfig = (input: ProviderRequestConfig): ProviderRequestConfig => ({
  protocol: input.protocol,
  baseUrl:
    input.protocol === 'openai'
      ? normalizeOpenAiBaseUrl(input.baseUrl || defaultBaseUrl(input.protocol))
      : withoutTrailingSlash(input.baseUrl || defaultBaseUrl(input.protocol)),
  apiKey: input.apiKey?.trim(),
  model: input.model?.trim(),
});

const readJson = async (response: globalThis.Response) => {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text, nonJson: true };
  }
};

const assertJsonPayload = (response: globalThis.Response, payload: any) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json') || payload?.nonJson) {
    const error = new Error(
      '供应商返回的不是 JSON API 响应，请检查 Base URL 是否缺少 /v1',
    ) as Error & { status?: number };
    error.status = 502;
    throw error;
  }
};

const providerError = (status: number, payload: any) => {
  const message =
    payload?.error?.message ||
    payload?.message ||
    payload?.error ||
    `供应商请求失败 (${status})`;
  const error = new Error(String(message)) as Error & { status?: number };
  error.status = status;
  return error;
};

const assertConfig = (config: ProviderRequestConfig) => {
  if (!config.apiKey) throw new Error('API Key 不能为空');
  if (!config.baseUrl) throw new Error('Base URL 不能为空');
  if (!config.model) throw new Error('模型 ID 不能为空');
};

const openAiHeaders = (config: ProviderRequestConfig) => ({
  Authorization: `Bearer ${config.apiKey}`,
  'Content-Type': 'application/json',
});

export const testOpenAi = async (config: ProviderRequestConfig) => {
  const response = await fetch(`${config.baseUrl}/models`, {
    headers: openAiHeaders(config),
  });
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status, payload);
  assertJsonPayload(response, payload);
  if (!Array.isArray(payload?.data)) {
    throw new Error('模型列表响应格式不兼容，请检查 Base URL 和协议');
  }

  return payload.data
    .map((item: { id?: string }) => item.id)
    .filter(Boolean)
    .sort();
};

const testGemini = async (config: ProviderRequestConfig) => {
  const response = await fetch(
    `${config.baseUrl}/models?key=${encodeURIComponent(config.apiKey)}`,
  );
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status, payload);

  return (payload?.models || [])
    .filter((item: { supportedGenerationMethods?: string[] }) =>
      item.supportedGenerationMethods?.includes('generateContent'),
    )
    .map((item: { name?: string }) => item.name?.replace(/^models\//, ''))
    .filter(Boolean)
    .sort();
};

const testAnthropic = async (config: ProviderRequestConfig) => {
  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status, payload);
  return [config.model];
};

const chatOpenAi = async (
  config: ProviderRequestConfig,
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {},
) => {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: openAiHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.7,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status, payload);
  assertJsonPayload(response, payload);

  return {
    content: payload?.choices?.[0]?.message?.content || '',
    usage: payload?.usage,
  };
};

const chatGemini = async (config: ProviderRequestConfig, messages: ChatMessage[]) => {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

  const response = await fetch(
    `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: { temperature: 0.7 },
      }),
    },
  );
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status, payload);

  return {
    content: (payload?.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || '')
      .join(''),
    usage: payload?.usageMetadata,
  };
};

const chatAnthropic = async (config: ProviderRequestConfig, messages: ChatMessage[]) => {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      ...(system ? { system } : {}),
      messages: messages
        .filter((message) => message.role !== 'system')
        .map(({ role, content }) => ({ role, content })),
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status, payload);

  return {
    content: (payload?.content || [])
      .filter((item: { type?: string }) => item.type === 'text')
      .map((item: { text?: string }) => item.text || '')
      .join(''),
    usage: payload?.usage,
  };
};

const asyncRoute =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch(next);
  };

export const createProviderRouter = () => {
  const router = Router();

  router.post(
    '/test',
    asyncRoute(async (request, response) => {
      const config = normalizeConfig(request.body?.config || {});
      assertConfig(config);
      const startedAt = Date.now();
      const models =
        config.protocol === 'gemini'
          ? await testGemini(config)
          : config.protocol === 'anthropic'
            ? await testAnthropic(config)
            : await testOpenAi(config);
      let chatVerified = config.protocol === 'anthropic';

      if (config.protocol === 'openai') {
        if (!models.includes(config.model)) {
          throw new Error(`模型 ${config.model} 不在供应商返回的可用模型列表中`);
        }
        const verification = await chatOpenAi(
          config,
          [{ role: 'user', content: 'Reply with OK only.' }],
          { maxTokens: 8, temperature: 0 },
        );
        if (!verification.content.trim()) {
          throw new Error('聊天接口验证失败：模型返回了空内容');
        }
        chatVerified = true;
      }

      response.json({
        ok: true,
        latency: Date.now() - startedAt,
        models,
        chatVerified,
        normalizedBaseUrl: config.baseUrl,
      });
    }),
  );

  router.post(
    '/chat',
    asyncRoute(async (request, response) => {
      const config = normalizeConfig(request.body?.config || {});
      const messages = request.body?.messages as ChatMessage[];
      assertConfig(config);
      if (!Array.isArray(messages) || !messages.length) {
        throw new Error('消息不能为空');
      }

      const result =
        config.protocol === 'gemini'
          ? await chatGemini(config, messages)
          : config.protocol === 'anthropic'
            ? await chatAnthropic(config, messages)
            : await chatOpenAi(config, messages);

      if (!result.content) throw new Error('模型返回了空内容');
      response.json(result);
    }),
  );

  router.post(
    '/image',
    asyncRoute(async (request, response) => {
      const config = normalizeConfig(request.body?.config || {});
      assertConfig(config);
      if (config.protocol !== 'openai') {
        throw new Error('当前图像工具支持 OpenAI 兼容协议，请选择支持 /images/generations 的 Provider');
      }

      const upstream = await fetch(`${config.baseUrl}/images/generations`, {
        method: 'POST',
        headers: openAiHeaders(config),
        body: JSON.stringify({
          model: config.model,
          prompt: String(request.body?.prompt || ''),
          size: request.body?.size || '1024x1024',
          quality: request.body?.quality || 'standard',
          n: 1,
        }),
      });
      const payload = await readJson(upstream);
      if (!upstream.ok) throw providerError(upstream.status, payload);
      const image = payload?.data?.[0];
      const url = image?.url || (image?.b64_json ? `data:image/png;base64,${image.b64_json}` : '');
      if (!url) throw new Error('图像供应商没有返回图片');
      response.json({ url, revisedPrompt: image?.revised_prompt });
    }),
  );

  router.use(
    (
      error: Error & { status?: number },
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      response.status(error.status || 500).json({
        error: error.message || '请求失败',
      });
    },
  );

  return router;
};
