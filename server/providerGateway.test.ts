import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { createProviderConfigStore, type ProviderConfigStore } from './providerConfigStore';
import {
  createProviderRouter,
  listProviderModels,
  normalizeOpenAiBaseUrl,
  sanitizeProviderError,
  testOpenAi,
  testProviderModels,
  type ProviderRequestConfig,
} from './providerGateway';

const config: ProviderRequestConfig = {
  category: 'language',
  protocol: 'chat-completions',
  baseUrl: 'https://example.com',
  apiKey: 'test-key',
  model: 'test-model',
};

test('redacts a provider key echoed by the upstream error', () => {
  const key = 'secret-provider-key-123456';
  const message = `Incorrect API key provided: ${key}`;
  const sanitized = sanitizeProviderError(message, key);
  assert.equal(sanitized.includes(key), false);
  assert.equal(sanitized.includes('secret-provider'), false);
});

test('model verification only calls the models endpoint', async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return Response.json({ data: [{ id: 'image-model' }] });
  };
  try {
    const result = await testProviderModels({ ...config, model: 'image-model', category: 'image' });
    assert.deepEqual(result, ['image-model']);
    assert.deepEqual(calls, ['https://example.com/v1/models']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('normalizes an OpenAI-compatible origin to its v1 API root', () => {
  assert.equal(
    normalizeOpenAiBaseUrl('https://api.bltcy.ai/'),
    'https://api.bltcy.ai/v1',
  );
  assert.equal(
    normalizeOpenAiBaseUrl('https://api.bltcy.ai/v1/'),
    'https://api.bltcy.ai/v1',
  );
  assert.equal(
    normalizeOpenAiBaseUrl('https://example.com/custom/openai/v1'),
    'https://example.com/custom/openai/v1',
  );
  assert.equal(
    normalizeOpenAiBaseUrl('https://llm.api.zyuncs.com/v1/response'),
    'https://llm.api.zyuncs.com/v1',
  );
  assert.equal(
    normalizeOpenAiBaseUrl('https://llm.api.zyuncs.com/v1/chat/completions'),
    'https://llm.api.zyuncs.com/v1',
  );
});

test('rejects an HTML success page as an invalid OpenAI API response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('<!doctype html><html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

  try {
    await assert.rejects(
      () => testOpenAi(config),
      /Base URL 是否缺少 \/v1/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('accepts a valid OpenAI model list', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      object: 'list',
      data: [{ id: 'gpt-5.5' }, { id: 'gpt-4.1' }],
    });

  try {
    assert.deepEqual(await testOpenAi(config), ['gpt-4.1', 'gpt-5.5']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sends the provider API key header alongside Bearer compatibility header', async () => {
  const originalFetch = globalThis.fetch;
  let capturedHeaders: Headers | undefined;
  globalThis.fetch = async (_input, init) => {
    capturedHeaders = new Headers(init?.headers);
    return Response.json({ object: 'list', data: [{ id: 'test-model' }] });
  };

  try {
    await testOpenAi(config);
    assert.equal(capturedHeaders?.get('api-key'), 'test-key');
    assert.equal(capturedHeaders?.get('authorization'), 'Bearer test-key');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('lists every model with optional name and context length, without a model id', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method?: string }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method });
    return Response.json({
      data: [
        { id: 'qwen3.8-max', context_length: 1_000_000 },
        { id: 'deepseek-v4', name: 'DeepSeek V4', context_window: 128_000 },
        { id: 'gpt-6', name: 'gpt-6' },
        { id: 'qwen3.8-max' },
        { id: '' },
        { object: 'model' },
      ],
    });
  };

  try {
    const models = await listProviderModels({ protocol: 'responses', baseUrl: 'https://example.com', apiKey: 'test-key' });
    assert.deepEqual(models, [
      { id: 'deepseek-v4', name: 'DeepSeek V4', contextLength: 128_000 },
      { id: 'gpt-6' },
      { id: 'qwen3.8-max', contextLength: 1_000_000 },
    ]);
    assert.deepEqual(calls, [{ url: 'https://example.com/v1/models', method: undefined }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('pages through the Anthropic model list', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    return url.includes('after_id')
      ? Response.json({ data: [{ id: 'claude-b', display_name: 'Claude B' }], has_more: false })
      : Response.json({ data: [{ id: 'claude-a' }], has_more: true, last_id: 'claude-a' });
  };

  try {
    const models = await listProviderModels({ protocol: 'anthropic-messages', baseUrl: 'https://api.anthropic.com/v1', apiKey: 'test-key' });
    assert.deepEqual(models, [{ id: 'claude-a' }, { id: 'claude-b', name: 'Claude B' }]);
    assert.deepEqual(calls, [
      'https://api.anthropic.com/v1/models?limit=1000',
      'https://api.anthropic.com/v1/models?limit=1000&after_id=claude-a',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('requires an API key before listing models', async () => {
  await assert.rejects(
    () => listProviderModels({ protocol: 'responses', baseUrl: 'https://example.com', apiKey: '  ' }),
    /API Key 不能为空/,
  );
});

/**
 * 起一个只挂载供应商路由的本地服务；发往本地的请求放行，其余交给 upstream 模拟上游。
 * API 配置写在临时目录，不碰用户真实的 providers.json。
 */
const withProviderRouter = async (
  upstream: typeof fetch,
  run: (
    post: (path: string, body: unknown) => Promise<globalThis.Response>,
    context: { local: string; store: ProviderConfigStore },
  ) => Promise<void>,
) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lizuo-provider-router-'));
  const store = createProviderConfigStore(path.join(root, 'providers.json'));
  const app = express();
  app.use(express.json());
  app.use('/api/provider', createProviderRouter(store));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const local = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => (String(input).startsWith(local) ? originalFetch(input, init) : upstream(input, init));
  try {
    await run((path, body) => originalFetch(`${local}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }), { local, store });
  } finally {
    globalThis.fetch = originalFetch;
    server.close();
    await fs.rm(root, { recursive: true, force: true });
  }
};

test('image route supports response_url without extra requests and preserves standard results', async () => {
  let calls = 0;
  let image: Record<string, unknown> = {};
  await withProviderRouter(async (_input, init) => {
    calls += 1;
    assert.equal(init?.method, 'POST');
    return Response.json({ data: [image] });
  }, async (post) => {
    const body = { config: { ...config, category: 'image' }, prompt: 'test image' };
    for (const [result, expected] of [
      [{ response_url: 'https://cdn.example.com/image?signature=example' }, 'https://cdn.example.com/image?signature=example'],
      [{ url: 'https://cdn.example.com/standard', response_url: 'https://cdn.example.com/other' }, 'https://cdn.example.com/standard'],
      [{ b64_json: 'aW1hZ2U=', response_url: 'https://cdn.example.com/other' }, 'data:image/png;base64,aW1hZ2U='],
    ] as const) {
      image = result;
      const response = await post('/api/provider/image', body);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { url: expected });
    }
    assert.equal(calls, 3);
  });
});

test('image route rejects malformed response_url and still fails when no image is returned', async () => {
  let image: Record<string, unknown> = {};
  await withProviderRouter(async () => Response.json({ data: [image] }), async (post) => {
    const body = { config: { ...config, category: 'image' }, prompt: 'test image' };
    for (const value of ['javascript:alert(1)', '/relative', 'https://user:pass@example.com/image']) {
      image = { response_url: value };
      const response = await post('/api/provider/image', body);
      assert.equal(response.status, 502);
      assert.match((await response.json() as { error: string }).error, /response_url/);
    }
    for (const result of [{}, { response_url: { url: 'https://example.com/image' } }]) {
      image = result;
      const response = await post('/api/provider/image', body);
      assert.equal(response.status, 500);
      assert.match((await response.json() as { error: string }).error, /图像供应商没有返回图片/);
    }
  });
});

/** fetch 不方便改 Host，用 node:http 模拟局域网和其他网站发来的请求。 */
const rawRequest = (url: string, headers: Record<string, string>, method = 'GET') =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const request = http.request(url, { method, headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode || 0, body }));
    });
    request.on('error', reject);
    request.end();
  });

test('models route returns the list with latency and labels failures as the common connection', async () => {
  const key = 'secret-provider-key-123456';
  let status = 200;
  await withProviderRouter(
    async () => (status === 200
      ? Response.json({ data: [{ id: 'b-model' }, { id: 'a-model', context_length: 8192 }] })
      : Response.json({ error: { message: `Incorrect API key provided: ${key}` } }, { status })),
    async (post) => {
      const ok = await post('/api/provider/models', { config: { protocol: 'chat-completions', baseUrl: 'https://example.com', apiKey: key } });
      const payload = await ok.json() as { models: unknown; latency: unknown; normalizedBaseUrl: unknown };
      assert.equal(ok.status, 200);
      assert.deepEqual(payload.models, [{ id: 'a-model', contextLength: 8192 }, { id: 'b-model' }]);
      assert.equal(typeof payload.latency, 'number');
      assert.equal(payload.normalizedBaseUrl, 'https://example.com/v1');

      status = 401;
      const denied = await post('/api/provider/models', { config: { protocol: 'chat-completions', baseUrl: 'https://example.com', apiKey: key } });
      const error = (await denied.json() as { error: string }).error;
      assert.equal(denied.status, 401);
      assert.match(error, /^通用连接 · example\.com · 401：/);
      assert.equal(error.includes(key), false);
    },
  );
});

test('models route reports 404 and unreachable upstreams without leaking the key', async () => {
  let mode: 'missing' | 'offline' = 'missing';
  await withProviderRouter(
    async () => {
      if (mode === 'offline') throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
      return Response.json({ error: { message: 'Not Found' } }, { status: 404 });
    },
    async (post) => {
      const body = { config: { protocol: 'responses', baseUrl: 'https://example.com/v1', apiKey: 'test-key' } };
      const missing = await post('/api/provider/models', body);
      assert.equal(missing.status, 404);
      assert.deepEqual(await missing.json(), { error: '通用连接 · example.com · 404：Not Found' });

      mode = 'offline';
      const offline = await post('/api/provider/models', body);
      assert.equal(offline.status, 502);
      assert.deepEqual(await offline.json(), { error: '通用连接 · example.com · 502：无法连接到供应商（ENOTFOUND），请检查 Base URL 和网络' });

      const noKey = await post('/api/provider/models', { config: { protocol: 'responses', baseUrl: 'https://example.com/v1', apiKey: '' } });
      assert.equal(noKey.status, 500);
      assert.deepEqual(await noKey.json(), { error: '通用连接 · example.com · 500：API Key 不能为空' });
    },
  );
});

const SAVED_KEY = 'sk-saved-provider-key-9876';

const savedProvider = {
  id: 'p1',
  name: 'Saved',
  protocol: 'chat-completions' as const,
  baseUrl: 'https://api.example.com/v1',
  apiKey: SAVED_KEY,
  models: [{ id: 'text', categories: ['language' as const] }],
  selectedModels: { language: 'text' },
};

test('config route returns only masked keys and is never cached', async () => {
  await withProviderRouter(
    async () => Response.json({}),
    async (_post, { local, store }) => {
      await store.saveProvider('p1', savedProvider);
      const response = await fetch(`${local}/api/provider/config`);
      const text = await response.text();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(text.includes(SAVED_KEY), false);
      const payload = JSON.parse(text);
      assert.equal(payload.providers[0].apiKey, '');
      assert.deepEqual(payload.providers[0].apiKeyHint, { masked: 'sk-…9876', origins: ['https://api.example.com'] });

      // 只有导出文件带完整 Key，格式沿用旧版本，方便互相导入。
      const exported = await fetch(`${local}/api/provider/config/export`, { method: 'POST' });
      const exportPayload = await exported.json() as { format: string; version: number; providers: Array<{ apiKey: string }> };
      assert.equal(exportPayload.format, 'design-work-provider-config');
      assert.equal(exportPayload.version, 3);
      assert.equal(exportPayload.providers[0].apiKey, SAVED_KEY);

      const mismatched = await fetch(`${local}/api/provider/config/providers/p2`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: savedProvider }),
      });
      assert.equal(mismatched.status, 400);
      assert.deepEqual(await mismatched.json(), { error: '厂商 ID 与请求地址不一致' });
    },
  );
});

test('config route reports a corrupt file and leaves it as it was', async () => {
  await withProviderRouter(
    async () => Response.json({}),
    async (_post, { local, store }) => {
      await fs.writeFile(store.filePath, 'not json');
      const response = await fetch(`${local}/api/provider/config`);
      assert.equal(response.status, 500);
      assert.match((await response.json() as { error: string }).error, /API 配置文件已损坏.*栗作没有改动它/);

      const save = await fetch(`${local}/api/provider/config/providers/p1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: savedProvider }),
      });
      assert.equal(save.status, 500);
      assert.equal(await fs.readFile(store.filePath, 'utf8'), 'not json');
    },
  );
});

test('models route fills in a saved key only for the host it was saved for', async () => {
  const calls: Array<{ url: string; authorization: string | null }> = [];
  await withProviderRouter(
    async (input, init) => {
      calls.push({ url: String(input), authorization: new Headers(init?.headers).get('authorization') });
      return Response.json({ data: [{ id: 'text' }] });
    },
    async (post, { store }) => {
      await store.saveProvider('p1', savedProvider);
      const storedKey = { providerId: 'p1', scope: 'provider' };

      const ok = await post('/api/provider/models', { config: { protocol: 'chat-completions', baseUrl: 'https://api.example.com/v1', apiKey: '', storedKey } });
      const text = await ok.text();
      assert.equal(ok.status, 200);
      assert.equal(text.includes(SAVED_KEY), false);
      assert.deepEqual(calls, [{ url: 'https://api.example.com/v1/models', authorization: `Bearer ${SAVED_KEY}` }]);

      const moved = await post('/api/provider/models', { config: { protocol: 'chat-completions', baseUrl: 'https://other.example/v1', apiKey: '', storedKey } });
      assert.equal(moved.status, 400);
      assert.match((await moved.json() as { error: string }).error, /^通用连接 · other\.example · 400：Base URL 的域名（host）与保存时不同/);

      const missing = await post('/api/provider/test', { config: { category: 'language', protocol: 'chat-completions', baseUrl: 'https://api.example.com/v1', apiKey: '', model: 'text', storedKey: { providerId: 'gone', scope: 'provider' } } });
      assert.equal(missing.status, 400);
      assert.match((await missing.json() as { error: string }).error, /已保存的 API Key 不存在/);
      assert.equal(calls.length, 1);
    },
  );
});

test('redacts a saved key that the upstream echoes back', async () => {
  // 这个 Key 不符合通用的 Key 格式，只能靠网关记下的实际 Key 打码。
  const plainKey = 'plainkey12345';
  await withProviderRouter(
    async () => Response.json({ error: { message: `Incorrect API key provided: ${plainKey}` } }, { status: 401 }),
    async (post, { store }) => {
      await store.saveProvider('p1', { ...savedProvider, apiKey: plainKey });
      const denied = await post('/api/provider/chat', {
        config: { category: 'language', protocol: 'chat-completions', baseUrl: 'https://api.example.com/v1', apiKey: '', model: 'text', storedKey: { providerId: 'p1', scope: 'provider' } },
        messages: [{ role: 'user', content: 'hi' }],
      });
      const error = (await denied.json() as { error: string }).error;
      assert.equal(denied.status, 401);
      assert.equal(error, '文本连接 · api.example.com · 401：Incorrect API key provided: [REDACTED]');
    },
  );
});

test('rejects requests from other hosts and other websites', async () => {
  let upstreamCalls = 0;
  await withProviderRouter(
    async () => {
      upstreamCalls += 1;
      return Response.json({ data: [] });
    },
    async (_post, { local, store }) => {
      await store.saveProvider('p1', savedProvider);
      const { host } = new URL(local);
      const forbidden = JSON.stringify({ error: 'API 配置只允许本机访问' });

      // 局域网设备或 DNS 重绑定：Host 不是本机。
      const lan = await rawRequest(`${local}/api/provider/config`, { Host: `192.168.1.20:${new URL(local).port}` });
      assert.deepEqual(lan, { status: 403, body: forbidden });
      const rebinding = await rawRequest(`${local}/api/provider/config/export`, { Host: `attacker.example:${new URL(local).port}` }, 'POST');
      assert.deepEqual(rebinding, { status: 403, body: forbidden });

      // 其他网站在浏览器里跨站请求本机网关。
      const crossSite = await rawRequest(`${local}/api/provider/config/export`, { Host: host, Origin: 'https://evil.example' }, 'POST');
      assert.deepEqual(crossSite, { status: 403, body: forbidden });
      const crossSiteModels = await rawRequest(`${local}/api/provider/models`, { Host: host, Origin: 'null' }, 'POST');
      assert.deepEqual(crossSiteModels, { status: 403, body: forbidden });
      assert.equal(upstreamCalls, 0);

      const sameOrigin = await rawRequest(`${local}/api/provider/config`, { Host: host, Origin: local });
      assert.equal(sameOrigin.status, 200);
      assert.equal(sameOrigin.body.includes(SAVED_KEY), false);
      const localhost = await rawRequest(`${local}/api/provider/config`, { Host: `localhost:${new URL(local).port}` });
      assert.equal(localhost.status, 200);
    },
  );
});
