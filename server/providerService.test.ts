import assert from 'node:assert/strict';
import test from 'node:test';
import { generateProviderImage, generateProviderText, listProviderModels } from '../src/services/providerService';
import type { ProviderConfig } from '../src/types/provider';

const provider: ProviderConfig = {
  id: 'mixed',
  name: 'Mixed',
  protocol: 'chat-completions',
  baseUrl: 'https://default.example/v1',
  apiKey: 'default-key',
  models: [
    { id: 'text', categories: ['language'] },
    {
      id: 'image',
      categories: ['image'],
      baseUrlOverride: 'https://image.example/v1',
      apiKeyOverride: 'image-key',
    },
  ],
  selectedModels: { language: 'text', image: 'image' },
};

test('text generation inherits Provider defaults', async () => {
  const originalFetch = globalThis.fetch;
  let body: any;
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ content: 'ok' });
  };
  try {
    await generateProviderText(provider, 'test');
    assert.equal(body.config.category, 'language');
    assert.equal(body.config.baseUrl, 'https://default.example/v1');
    assert.equal(body.config.apiKey, 'default-key');
    assert.equal(JSON.stringify(body).includes('image-key'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('image generation sends only the selected model overrides', async () => {
  const originalFetch = globalThis.fetch;
  let body: any;
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ url: 'https://example.com/image.png' });
  };
  try {
    await generateProviderImage(
      provider,
      { prompt: 'test', size: '1024x1024', quality: 'high' },
      'image',
    );
    assert.equal(body.config.category, 'image');
    assert.equal(body.config.baseUrl, 'https://image.example/v1');
    assert.equal(body.config.apiKey, 'image-key');
    assert.equal(JSON.stringify(body).includes('default-key'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/** 网关返回的配置：Key 只剩掩码。 */
const savedProvider: ProviderConfig = {
  ...provider,
  apiKey: '',
  apiKeyHint: { masked: 'sk-…abcd', origins: ['https://default.example'] },
  models: [
    { id: 'text', categories: ['language'] },
    {
      id: 'image',
      categories: ['image'],
      baseUrlOverride: 'https://image.example/v1',
      apiKeyOverrideHint: { masked: 'sk-…efgh', origins: ['https://image.example'] },
    },
  ],
};

const captureBody = async (send: () => Promise<unknown>) => {
  const originalFetch = globalThis.fetch;
  let body: any;
  globalThis.fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ content: 'ok', url: 'https://example.com/image.png', models: [] });
  };
  try {
    await send();
    return body;
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test('a saved Provider key is sent as a reference for the gateway to fill in', async () => {
  const body = await captureBody(() => generateProviderText(savedProvider, 'test'));
  assert.equal(body.config.apiKey, '');
  assert.deepEqual(body.config.storedKey, { providerId: 'mixed', scope: 'provider' });
  assert.equal(body.config.baseUrl, 'https://default.example/v1');
});

test('a saved model key takes precedence over the Provider key', async () => {
  const body = await captureBody(() => generateProviderImage(
    savedProvider,
    { prompt: 'test', size: '1024x1024', quality: 'high' },
    'image',
  ));
  assert.equal(body.config.apiKey, '');
  assert.deepEqual(body.config.storedKey, { providerId: 'mixed', modelId: 'image', scope: 'model' });
  assert.equal(body.config.baseUrl, 'https://image.example/v1');
});

test('a newly typed key is sent instead of the saved one', async () => {
  const body = await captureBody(() => listProviderModels({ ...savedProvider, apiKey: ' new-key ' }));
  assert.deepEqual(body.config, { protocol: 'chat-completions', baseUrl: 'https://default.example/v1', apiKey: 'new-key' });

  const saved = await captureBody(() => listProviderModels(savedProvider));
  assert.deepEqual(saved.config, {
    protocol: 'chat-completions',
    baseUrl: 'https://default.example/v1',
    apiKey: '',
    storedKey: { providerId: 'mixed', scope: 'provider' },
  });
});

test('generation without any key is refused before reaching the gateway', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return Response.json({});
  };
  try {
    // 缺少连接配置时 generateProviderText 同步抛错，包一层 async 统一按 Promise 判断。
    await assert.rejects(
      async () => generateProviderText({ ...savedProvider, apiKeyHint: undefined }, 'test'),
      /当前厂商未完成文本模型连接配置/,
    );
    await assert.rejects(
      listProviderModels({ ...savedProvider, apiKeyHint: undefined }),
      /请先填写通用 Base URL 和 API Key/,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
