import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { Agent, fetch as undiciFetch } from 'undici';
import type { ModelCategory, ProviderModelInfo, ProviderProtocol } from '../src/types/provider';
import {
  createProviderConfigStore,
  defaultProviderConfigPath,
  ProviderConfigError,
  type ProviderConfigStore,
} from './providerConfigStore';

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

const assertConnection = (config: ProviderRequestConfig) => {
  if (!config.apiKey) throw new Error('API Key 不能为空');
  if (!config.baseUrl) throw new Error('Base URL 不能为空');
};

const assertConfig = (config: ProviderRequestConfig) => {
  assertConnection(config);
  if (!config.model) throw new Error('模型 ID 不能为空');
};

const openAiHeaders = (config: ProviderRequestConfig) => ({
  Authorization: `Bearer ${config.apiKey}`,
  // 智汇云 API keys 鉴权要求使用 api-key；保留 Bearer 头以兼容其他 OpenAI 兼容供应商。
  'api-key': config.apiKey,
  'Content-Type': 'application/json',
});

// 各家中转站对上下文长度的字段名不统一，只读取常见的几种；都没有就不显示。
const CONTEXT_LENGTH_KEYS = ['context_length', 'context_window', 'max_context_length', 'max_model_len'];

const toModelInfo = (value: unknown): ProviderModelInfo | undefined => {
  const item = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  if (!id) return undefined;
  const rawName = typeof item.display_name === 'string' ? item.display_name : item.name;
  const name = typeof rawName === 'string' && rawName.trim() !== id ? rawName.trim() : '';
  const contextLength = CONTEXT_LENGTH_KEYS
    .map((key) => item[key])
    .find((length): length is number => typeof length === 'number' && Number.isFinite(length) && length > 0);
  return { id, ...(name ? { name } : {}), ...(contextLength ? { contextLength } : {}) };
};

const INCOMPATIBLE_MODEL_LIST = '模型列表响应格式不兼容，请检查 Base URL 和协议';

const parseModelList = (items: unknown): ProviderModelInfo[] => {
  if (!Array.isArray(items)) throw new Error(INCOMPATIBLE_MODEL_LIST);
  const models = new Map<string, ProviderModelInfo>();
  for (const item of items) {
    const model = toModelInfo(item);
    if (model && !models.has(model.id)) models.set(model.id, model);
  }
  return [...models.values()].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
};

const fetchOpenAiModels = async (config: ProviderRequestConfig) => {
  const response = await fetch(`${config.baseUrl}/models`, {
    headers: openAiHeaders(config),
  });
  const payload = await readJson(response);
  if (!response.ok) throw providerError(response.status, payload);
  assertJsonPayload(response, payload);
  return parseModelList(payload?.data);
};

export const testOpenAi = async (config: ProviderRequestConfig) =>
  (await fetchOpenAiModels(config)).map((model) => model.id);

// Anthropic 的模型列表默认每页 20 个，按 has_more / last_id 翻页才能拿全。
const ANTHROPIC_MODEL_PAGE_SIZE = 1000;
const MAX_MODEL_PAGES = 20;

const fetchAnthropicModels = async (config: ProviderRequestConfig) => {
  const items: unknown[] = [];
  let afterId = '';
  for (let page = 0; page < MAX_MODEL_PAGES; page += 1) {
    const query = new URLSearchParams({ limit: String(ANTHROPIC_MODEL_PAGE_SIZE) });
    if (afterId) query.set('after_id', afterId);
    const response = await fetch(`${config.baseUrl}/models?${query}`, {
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });
    const payload = await readJson(response);
    if (!response.ok) throw providerError(response.status, payload);
    assertJsonPayload(response, payload);
    if (!Array.isArray(payload?.data)) throw new Error(INCOMPATIBLE_MODEL_LIST);
    items.push(...payload.data);
    if (!payload.has_more || typeof payload.last_id !== 'string' || !payload.last_id) break;
    afterId = payload.last_id;
  }
  return parseModelList(items);
};

const fetchModels = (config: ProviderRequestConfig) =>
  config.protocol === 'anthropic-messages'
    ? fetchAnthropicModels(config)
    : fetchOpenAiModels(config);

/** 只读取模型列表，不需要指定模型，也不发起生成。 */
export const listProviderModels = async (input: Partial<ProviderRequestConfig>) => {
  const config = normalizeConfig(input as ProviderRequestConfig);
  assertConnection(config);
  return fetchModels(config);
};

export const testProviderModels = async (input: ProviderRequestConfig) => {
  const config = normalizeConfig(input);
  assertConfig(config);
  return (await fetchModels(config)).map((model) => model.id);
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

const hostnameOf = (host: string) => {
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const isLoopbackHostname = (hostname: string) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(hostname) || hostname.endsWith('.localhost');

/**
 * 网关保存着完整的 API Key，只接受本机页面的请求：Host 必须是本机地址（挡住局域网访问和 DNS 重绑定），
 * 带 Origin 时必须与 Host 一致（挡住其他网站在浏览器里发起的跨站请求）。
 */
const requireLocalRequest = (request: Request, response: Response, next: NextFunction) => {
  const host = String(request.headers.host || '').toLowerCase();
  const origin = request.headers.origin;
  let sameOrigin = true;
  if (origin !== undefined) {
    try {
      sameOrigin = new URL(String(origin)).host.toLowerCase() === host;
    } catch {
      sameOrigin = false;
    }
  }
  if (!isLoopbackHostname(hostnameOf(host)) || !sameOrigin) {
    response.status(403).json({ error: 'API 配置只允许本机访问' });
    return;
  }
  next();
};

const configRoute =
  (handler: (request: Request) => Promise<unknown>) =>
  (request: Request, response: Response) => {
    response.set('Cache-Control', 'no-store');
    handler(request).then(
      (body) => {
        response.json(body);
      },
      (error: Error) => {
        if (error instanceof ProviderConfigError) {
          response.status(error.status).json({ error: error.message });
          return;
        }
        response.status(500).json({
          error: `API 配置操作失败：${sanitizeProviderError(error?.message)}`,
        });
      },
    );
  };

export const createProviderRouter = (
  configStore: ProviderConfigStore = createProviderConfigStore(defaultProviderConfigPath()),
) => {
  const router = Router();
  router.use(requireLocalRequest);

  // 请求没带 Key 时，按 storedKey 引用从本机配置里取出已保存的 Key。
  const resolveRequestConfig = async (request: Request, response: Response) => {
    const config = normalizeConfig(request.body?.config || {});
    if (!config.apiKey && request.body?.config?.storedKey) {
      config.apiKey = await configStore.resolveStoredKey(request.body.config.storedKey, config.baseUrl);
    }
    response.locals.providerApiKey = config.apiKey || '';
    return config;
  };

  router.get('/config', configRoute(() => configStore.read()));
  router.put('/config/providers/:id', configRoute((request) =>
    configStore.saveProvider(String(request.params.id), request.body?.provider)));
  router.delete('/config/providers/:id', configRoute((request) =>
    configStore.removeProvider(String(request.params.id))));
  router.put('/config/active', configRoute((request) =>
    configStore.setActiveProvider(request.body?.category, request.body?.providerId)));
  router.put('/config/selected-model', configRoute((request) =>
    configStore.setSelectedModel(request.body?.providerId, request.body?.category, request.body?.modelId)));
  router.post('/config/import', configRoute((request) =>
    configStore.importProviders(request.body, request.body?.mode)));
  // 导出文件包含完整的 Key，沿用原来的格式，旧版本导出的文件也能互相导入。
  router.post('/config/export', configRoute(async () => {
    const state = await configStore.exportState();
    return {
      format: 'design-work-provider-config',
      version: 3,
      exportedAt: new Date().toISOString(),
      activeProviderIds: state.activeProviderIds,
      providers: state.providers,
    };
  }));

  router.post(
    '/test',
    asyncRoute(async (request, response) => {
      const config = await resolveRequestConfig(request, response);
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
    '/models',
    asyncRoute(async (request, response) => {
      const config = await resolveRequestConfig(request, response);
      assertConnection(config);
      const startedAt = Date.now();
      const models = await fetchModels(config);

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
      const config = await resolveRequestConfig(request, response);
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
      const config = await resolveRequestConfig(request, response);
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
      const config = await resolveRequestConfig(request, response);
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
      // 只读取模型列表的请求不带类型，按通用连接标注。
      const label = config?.category && categoryLabels[config.category]
        ? `${categoryLabels[config.category]}连接`
        : config?.baseUrl ? '通用连接' : '';
      // 网络不通时 fetch 只抛出 “fetch failed”，换成能操作的提示，并带上底层错误码。
      const unreachable = error instanceof TypeError && error.message === 'fetch failed';
      const causeCode = (error.cause as { code?: unknown } | undefined)?.code;
      const status = error.status || (unreachable ? 502 : 500);
      const message = unreachable
        ? `无法连接到供应商${typeof causeCode === 'string' ? `（${causeCode}）` : ''}，请检查 Base URL 和网络`
        : error.message;
      let context = '';
      if (label) {
        let host = '未知 Host';
        try {
          host = new URL(String(config?.baseUrl || '')).host || host;
        } catch {
          // Keep a safe generic host label for malformed URLs.
        }
        context = `${label} · ${host} · ${status}：`;
      }
      response.status(status).json({
        error: `${context}${sanitizeProviderError(message, String(response.locals.providerApiKey || config?.apiKey || ''))}`,
      });
    },
  );

  return router;
};
