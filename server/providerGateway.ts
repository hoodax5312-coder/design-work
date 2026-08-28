import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { Agent, fetch as undiciFetch } from 'undici';
import type { ModelCategory, ProviderProtocol } from '../src/types/provider';

export type { ProviderProtocol } from '../src/types/provider';

export interface ProviderRequestConfig {
  category: ModelCategory;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const videoDispatcher = new Agent({
  headersTimeout: 15 * 60 * 1000,
  bodyTimeout: 15 * 60 * 1000,
});

const withoutTrailingSlash = (value: string) => value.trim().replace(/\/+$/, '');

export const normalizeOpenAiBaseUrl = (value: string) => {
  const normalized = withoutTrailingSlash(value);
  if (!normalized) return normalized;

  try {
    const url = new URL(normalized);
    const endpointSuffix = /\/(?:response|responses|models|messages|chat\/completions|images(?:\/360ai)?\/generations|video\/generations)$/;
    url.pathname = url.pathname.replace(endpointSuffix, '');
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/v1';
    }
    return withoutTrailingSlash(url.toString());
  } catch {
    return normalized;
  }
};

const defaultBaseUrl = (protocol: ProviderProtocol) => {
  if (protocol === 'anthropic-messages') return 'https://api.anthropic.com/v1';
  return 'https://api.openai.com/v1';
};

const normalizeConfig = (input: ProviderRequestConfig): ProviderRequestConfig => ({
  category: input.category,
  protocol: input.protocol,
  baseUrl:
    input.protocol !== 'anthropic-messages'
      ? normalizeOpenAiBaseUrl(input.baseUrl || defaultBaseUrl(input.protocol))
      : withoutTrailingSlash(input.baseUrl || defaultBaseUrl(input.protocol)),
  apiKey: input.apiKey?.trim(),
  model: input.model?.trim(),
});

export const sanitizeProviderError = (message: unknown, apiKey = '') => {
  let sanitized = String(message || '请求失败');
  const trimmedKey = apiKey.trim();
  if (trimmedKey) sanitized = sanitized.split(trimmedKey).join('[REDACTED]');
  return sanitized
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:api[-_ ]?key|token)\s*[:=]\s*[^\s,;]+/gi, '$1: [REDACTED]')
    .replace(/\b(?:sk|key)-[A-Za-z0-9._*-]{8,}\b/gi, '[REDACTED]')
    .replace(/\b[A-Za-z0-9][A-Za-z0-9._*-]{23,}\b/g, '[REDACTED]');
};

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

const upstreamError = (status: number, payload: any) => {
  const error = providerError(status, payload);
  error.message = `${error.message}。请检查 Base URL、模型能力和供应商 Host 白名单。`;
  return error;
};

const assertConfig = (config: ProviderRequestConfig) => {
  if (!config.apiKey) throw new Error('API Key 不能为空');
  if (!config.baseUrl) throw new Error('Base URL 不能为空');
  if (!config.model) throw new Error('模型 ID 不能为空');
};

const openAiHeaders = (config: ProviderRequestConfig) => ({
  Authorization: `Bearer ${config.apiKey}`,
  // 智汇云 API keys 鉴权要求使用 api-key；保留 Bearer 头以兼容其他 OpenAI 兼容供应商。
  'api-key': config.apiKey,
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

const testAnthropic = async (config: ProviderRequestConfig) => {
  const response = await fetch(`${config.baseUrl}/models`, {
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
  });
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status, payload);
  assertJsonPayload(response, payload);
  if (!Array.isArray(payload?.data)) {
    throw new Error('模型列表响应格式不兼容，请检查 Base URL 和协议');
  }
  return payload.data.map((item: { id?: string }) => item.id).filter(Boolean).sort();
};

export const testProviderModels = async (input: ProviderRequestConfig) => {
  const config = normalizeConfig(input);
  assertConfig(config);
  return config.protocol === 'anthropic-messages'
    ? testAnthropic(config)
    : testOpenAi(config);
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

const chatResponses = async (
  config: ProviderRequestConfig,
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {},
) => {
  const response = await fetch(`${config.baseUrl}/responses`, {
    method: 'POST',
    headers: openAiHeaders(config),
    body: JSON.stringify({
      model: config.model,
      input: messages.map(({ role, content }) => ({ role, content })),
      ...(options.maxTokens ? { max_output_tokens: options.maxTokens } : {}),
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
    }),
  });
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status, payload);
  assertJsonPayload(response, payload);

  const content = payload?.output_text || (payload?.output || [])
    .flatMap((item: { content?: Array<{ text?: string }> }) => item.content || [])
    .map((item: { text?: string }) => item.text || '')
    .join('');
  return { content, usage: payload?.usage };
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
      const models = await testProviderModels(config);

      response.json({
        ok: true,
        latency: Date.now() - startedAt,
        models,
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
        config.protocol === 'anthropic-messages'
            ? await chatAnthropic(config, messages)
            : config.protocol === 'responses'
              ? await chatResponses(config, messages)
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
      if (config.protocol === 'anthropic-messages') {
        throw new Error('当前图像工具支持 OpenAI 的 Responses 或 Chat Completions 格式，请选择支持 /images/generations 的 Provider');
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
      if (!upstream.ok) throw upstreamError(upstream.status, payload);
      const image = payload?.data?.[0];
      const url = image?.url || (image?.b64_json ? `data:image/png;base64,${image.b64_json}` : '');
      if (!url) throw new Error('图像供应商没有返回图片');
      response.json({ url, revisedPrompt: image?.revised_prompt });
    }),
  );

  router.post(
    '/video',
    asyncRoute(async (request, response) => {
      const config = normalizeConfig(request.body?.config || {});
      assertConfig(config);
      const upstream = await undiciFetch(`${config.baseUrl}/video/generations`, {
        method: 'POST',
        headers: openAiHeaders(config),
        body: JSON.stringify({
          model: config.model,
          prompt: String(request.body?.prompt || ''),
          resolution: request.body?.resolution || '480x320',
          response_format: 'b64_json',
          n: 1,
        }),
        dispatcher: videoDispatcher,
      });
      const payload = await readJson(upstream);
      if (!upstream.ok) throw upstreamError(upstream.status, payload);
      const item = payload?.data?.[0] || payload?.output || payload;
      const url = item?.url
        || item?.video_url
        || item?.output_url
        || payload?.url
        || (item?.b64_json ? `data:video/mp4;base64,${item.b64_json}` : '');
      if (!url) throw new Error('视频供应商没有返回视频；需要返回 data[0].url 或 data[0].b64_json');
      response.json({ url, id: item?.id || payload?.id });
    }),
  );

  router.use(
    (
      error: Error & { status?: number },
      request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      const config = request.body?.config as Partial<ProviderRequestConfig> | undefined;
      const categoryLabels: Record<ModelCategory, string> = {
        language: '文本',
        image: '生图',
        video: '视频',
      };
      let context = '';
      if (config?.category && categoryLabels[config.category]) {
        let host = '未知 Host';
        try {
          host = new URL(String(config.baseUrl || '')).host || host;
        } catch {
          // Keep a safe generic host label for malformed URLs.
        }
        context = `${categoryLabels[config.category]}连接 · ${host} · ${error.status || 500}：`;
      }
      response.status(error.status || 500).json({
        error: `${context}${sanitizeProviderError(error.message, String(config?.apiKey || ''))}`,
      });
    },
  );

  return router;
};
