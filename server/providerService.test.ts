import assert from 'node:assert/strict';
import test from 'node:test';
import { generateProviderImage, generateProviderText } from '../src/services/providerService';
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
