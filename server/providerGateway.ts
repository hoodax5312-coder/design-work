import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { Agent, fetch as undiciFetch } from 'undici';
import { assertImageEditSupported } from '../src/lib/imageEditSupport';
import { resolveCanvasImageParameters } from '../src/lib/canvasImageCapabilities';
import { assertMusicModelSupported } from '../src/lib/musicModels';
import { MAX_AUDIO_BYTES, storeAudioAsset } from './audioAssetStorage';
import { readReferenceImageAsset } from './referenceImageAsset';
import type { LibraryRuntime } from './libraryRuntime';
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
    const endpointSuffix = /\/(?:response|responses|models|messages|chat\/completions|images\/edits|images(?:\/360ai)?\/generations|video\/generations|audio\/speech)$/;
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

const readJson = async (response: Pick<globalThis.Response, 'text'>) => {
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
  getRuntime?: () => Promise<LibraryRuntime>,
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

      // 画布声明的参数必须经共享能力表校验；其他生成入口保留原有请求合同。
      if (request.body?.canvasParameters !== undefined) {
        const parameters = request.body.canvasParameters;
        try {
          if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new Error('画布图片参数无效');
          const resolved = resolveCanvasImageParameters(config.protocol, config.model, parameters);
          request.body.size = resolved.size;
          request.body.quality = resolved.quality;
        } catch (error) {
          throw Object.assign(error instanceof Error ? error : new Error('画布图片参数无效'), { status: 400 });
        }
      }

      const hasReference = request.body?.referenceImage !== undefined;
      let editBody: FormData | undefined;
      if (hasReference) {
        assertImageEditSupported(config.protocol, config.model);
        const reference = request.body.referenceImage;
        if (!reference || typeof reference !== 'object' || Array.isArray(reference)
          || Object.keys(reference).some((key) => key !== 'assetId')) {
          throw Object.assign(new Error('参考图请求只接受资产 ID，不接受路径或 URL'), { status: 400 });
        }
        if (!getRuntime) throw new Error('本机资产服务未连接，无法读取参考图');
        const image = await readReferenceImageAsset(await getRuntime(), reference.assetId);
        const size = request.body?.size || '1024x1024';
        const quality = request.body?.quality || 'standard';
        if (!['1024x1024', '1536x1024', '1024x1536', 'auto'].includes(size)) {
          throw Object.assign(new Error('标准图生图不支持此尺寸'), { status: 400 });
        }
        const editQuality = quality === 'standard' ? 'medium' : quality === 'hd' ? 'high' : quality;
        if (!['auto', 'low', 'medium', 'high'].includes(editQuality)) {
          throw Object.assign(new Error('标准图生图不支持此质量'), { status: 400 });
        }
        editBody = new FormData();
        editBody.set('image', new Blob([new Uint8Array(image.bytes)], { type: image.mimeType }), image.name);
        editBody.set('model', config.model);
        editBody.set('prompt', String(request.body?.prompt || ''));
        editBody.set('size', size);
        editBody.set('quality', editQuality);
        editBody.set('n', '1');
      }
      // A failed edit is never retried as generation (or with different paid parameters).
      const multipartHeaders = new Headers(openAiHeaders(config));
      multipartHeaders.delete('Content-Type');
      const upstream = await fetch(`${config.baseUrl}/images/${hasReference ? 'edits' : 'generations'}`, {
        method: 'POST',
        headers: hasReference ? multipartHeaders : openAiHeaders(config),
        body: editBody || JSON.stringify({
          model: config.model,
          prompt: String(request.body?.prompt || ''),
          size: request.body?.size || '1024x1024',
          quality: request.body?.quality || 'standard',
          n: 1,
        }),
      });
      const payload = await readJson(upstream);
      if (!upstream.ok) throw upstreamError(upstream.status, payload);
      assertJsonPayload(upstream, payload);
      const image = payload?.data?.[0];
      let url = image?.url || (image?.b64_json ? `data:image/png;base64,${image.b64_json}` : '');
      // Some OpenAI-compatible providers name the result URL response_url.
      // Do not fetch it here or forward the provider key to a result host.
      if (!url && typeof image?.response_url === 'string') {
        try {
          const resultUrl = new URL(image.response_url);
          if (!['https:', 'http:'].includes(resultUrl.protocol) || resultUrl.username || resultUrl.password) {
            throw new Error('Invalid image result URL');
          }
          url = resultUrl.href;
        } catch {
          throw Object.assign(new Error('图像供应商返回的 response_url 不是有效的 HTTP 图片结果地址'), { status: 502 });
        }
      }
      if (!url) throw new Error('图像供应商没有返回图片');
      response.json({ url, revisedPrompt: image?.revised_prompt });
    }),
  );

  router.post(
    '/video',
    asyncRoute(async (request, response) => {
      if (request.body?.referenceImage !== undefined) {
        throw Object.assign(new Error('当前视频网关尚无真实 image 字段协议，不支持参考图；不会忽略参考图发起收费请求'), { status: 400 });
      }
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

  /**
   * 文本生成音乐：只对登记过真实协议的模型发请求（见 src/lib/musicModels.ts），不回退为 TTS。
   * 单次提交、不自动重试；结果在网关直接写入本机资产库，浏览器只拿资产 ID。
   */
  router.post(
    '/music',
    asyncRoute(async (request, response) => {
      const config = await resolveRequestConfig(request, response);
      if (config.category !== 'music') throw Object.assign(new Error('音乐生成必须使用音乐类型的模型连接'), { status: 400 });
      const capability = assertMusicModelSupported(config.protocol, config.model);
      assertConfig(config);
      if (!getRuntime) throw new Error('本机资产服务未连接，无法保存音乐结果');
      const prompt = typeof request.body?.prompt === 'string' ? request.body.prompt.trim() : '';
      if (!prompt) throw Object.assign(new Error('请先填写音乐描述'), { status: 400 });
      if (prompt.length > 4100) throw Object.assign(new Error('音乐描述不能超过 4100 个字符'), { status: 400 });
      const seconds = Number(request.body?.durationSeconds);
      if (!Number.isInteger(seconds) || seconds < capability.minSeconds || seconds > capability.maxSeconds) {
        throw Object.assign(new Error(`时长需为 ${capability.minSeconds}–${capability.maxSeconds} 秒的整数`), { status: 400 });
      }
      const instrumental = capability.instrumentalToggle ? request.body?.instrumental !== false : true;
      const upstream = await undiciFetch(`${config.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: openAiHeaders(config),
        body: JSON.stringify({
          model: config.model,
          input: prompt,
          response_format: 'mp3',
          metadata: {
            music_length_ms: seconds * 1000,
            force_instrumental: instrumental,
            respect_sections_durations: true,
            output_format: 'mp3_44100_128',
          },
        }),
        dispatcher: videoDispatcher,
      });
      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      let bytes: Uint8Array | undefined;
      if (!upstream.ok) {
        throw upstreamError(upstream.status, await readJson(upstream as unknown as globalThis.Response));
      }
      if (!contentType.includes('application/json')) {
        bytes = new Uint8Array(await upstream.arrayBuffer());
      } else {
        const payload = await upstream.json() as any;
        const first = Array.isArray(payload?.data) ? payload.data[0] : undefined;
        const audioObject = payload?.audio && typeof payload.audio === 'object' ? payload.audio : {};
        const resultUrl = [payload?.url, payload?.audio_url, payload?.audioUrl, audioObject.url, first?.url, first?.audio_url, first?.audioUrl]
          .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
        const base64 = [first?.b64_json, first?.audio, payload?.b64_json, typeof payload?.audio === 'string' ? payload.audio : undefined]
          .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
        if (base64) {
          bytes = Buffer.from(base64.replace(/^data:[^,]*,/, ''), 'base64');
        } else if (resultUrl) {
          let parsed: URL;
          try {
            parsed = new URL(resultUrl);
          } catch {
            throw Object.assign(new Error('音乐供应商返回的结果地址无效'), { status: 502 });
          }
          if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
            throw Object.assign(new Error('音乐供应商返回的结果地址不是有效的 HTTP 地址'), { status: 502 });
          }
          // 结果地址可能在别的域名，不带供应商 Key 下载；只下载一次。
          const download = await undiciFetch(parsed.href, { dispatcher: videoDispatcher });
          if (!download.ok) throw Object.assign(new Error(`下载音乐结果失败（HTTP ${download.status}）`), { status: 502 });
          if (Number(download.headers.get('content-length') || 0) > MAX_AUDIO_BYTES) throw Object.assign(new Error('音乐结果超过 100 MB'), { status: 502 });
          bytes = new Uint8Array(await download.arrayBuffer());
        }
      }
      if (!bytes?.length) throw Object.assign(new Error('音乐供应商没有返回音频内容或下载地址'), { status: 502 });
      let stored: Awaited<ReturnType<typeof storeAudioAsset>>;
      try {
        stored = await storeAudioAsset(await getRuntime(), bytes, {
          title: `画布音乐 · ${new Date().toLocaleDateString('zh-CN')}`,
          description: prompt,
          userMetadata: {
            source: 'canvas',
            kind: 'music',
            prompt,
            model: config.model,
            requestedSeconds: seconds,
            instrumental,
            ...(typeof request.body?.canvasNodeId === 'string' ? { canvasNodeId: request.body.canvasNodeId } : {}),
          },
        });
      } catch (error) {
        throw Object.assign(new Error(`供应商已返回结果，但保存到本机资产库失败：${(error as Error).message}`), { status: 502 });
      }
      response.json({ assetId: stored.asset.id, title: stored.asset.title, mimeType: stored.mimeType, requestedSeconds: seconds, instrumental });
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
        music: '音乐',
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
