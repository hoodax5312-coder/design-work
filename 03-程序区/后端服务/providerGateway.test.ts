import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeOpenAiBaseUrl,
  testOpenAi,
  type ProviderRequestConfig,
} from './providerGateway';

const config: ProviderRequestConfig = {
  protocol: 'chat-completions',
  baseUrl: 'https://example.com',
  apiKey: 'test-key',
  model: 'test-model',
};

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
