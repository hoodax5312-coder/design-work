import assert from 'node:assert/strict';
import test from 'node:test';
import { generateProviderImage } from '../src/services/providerService';
import type { ProviderConfig } from '../src/types/provider';

test('image service preserves reference asset, model override and cancellation; errors do not retry', async () => {
  const provider: ProviderConfig = {
    id: 'p', name: 'test', protocol: 'responses', baseUrl: 'https://example.invalid/v1', apiKey: 'test-only',
    selectedModels: { image: 'gpt-image-2' },
    models: [{ id: 'gpt-image-2', categories: ['image'], baseUrlOverride: 'https://override.invalid/v1', apiKeyOverride: 'override-only' }],
  };
  const input = { prompt: 'edit', size: '1024x1024', quality: 'standard', referenceImage: { assetId: 'asset-1' } };
  const controller = new AbortController();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls += 1;
    assert.equal(url, '/api/provider/image');
    assert.equal(options?.signal, controller.signal);
    const body = JSON.parse(String(options?.body));
    assert.deepEqual(body.referenceImage, { assetId: 'asset-1' });
    assert.equal(body.config.model, 'gpt-image-2');
    assert.equal(body.config.baseUrl, 'https://override.invalid/v1');
    assert.equal(body.config.apiKey, 'override-only');
    return calls === 1 ? Response.json({ url: 'data:image/png;base64,eA==' }) : Response.json({ error: 'edit denied' }, { status: 429 });
  };
  try {
    assert.equal((await generateProviderImage(provider, input, 'gpt-image-2', controller.signal)).url, 'data:image/png;base64,eA==');
    await assert.rejects(generateProviderImage(provider, input, 'gpt-image-2', controller.signal), /edit denied/);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
