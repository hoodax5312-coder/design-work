import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
