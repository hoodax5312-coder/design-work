import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import sharp from 'sharp';
import { openLibraryDatabase } from './database';
import type { LibraryRuntime } from './libraryRuntime';
import { AssetRepository } from './repositories/AssetRepository';
import { createProviderConfigStore } from './providerConfigStore';
import { createProviderRouter, normalizeOpenAiBaseUrl } from './providerGateway';

// Both hops use real local HTTP; no external provider or real credentials are used.
test('asset original -> provider multipart edits, with fail-closed errors and no retries', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lizuo-edits-'));
  const database = openLibraryDatabase(':memory:');
  const assets = new AssetRepository(database);
  const runtime = { database, assets } as LibraryRuntime;
  const original = await sharp({ create: { width: 37, height: 21, channels: 3, background: '#aabbcc' } }).png().toBuffer();
  const originalPath = path.join(root, 'original.png');
  await fs.writeFile(originalPath, original);
  const asset = assets.create({ type: 'image', title: 'original', fileReference: {
    absolutePath: originalPath, extension: 'png', fileName: 'original.png', fileSize: original.length,
  } });
  const upstreamApp = express();
  upstreamApp.use(express.raw({ type: () => true, limit: '12mb' }));
  const calls: Array<{ path: string; body: Buffer; headers: Record<string, unknown> }> = [];
  let status = 200;
  let payload: unknown = { data: [{ b64_json: 'cGljdHVyZQ==', revised_prompt: 'edited' }] };
  upstreamApp.use((req, res) => {
    calls.push({ path: req.path, body: req.body, headers: req.headers });
    res.status(status).json(payload);
  });
  const upstream = upstreamApp.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const baseUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/v1`;
  const store = createProviderConfigStore(path.join(root, 'providers.json'));
  const app = express();
  app.use(express.json());
  app.use('/api/provider', createProviderRouter(store, async () => runtime));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const local = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const config = { category: 'image', protocol: 'responses', baseUrl, apiKey: 'test-only-key', model: 'gpt-image-2' };
  const post = (extra: Record<string, unknown> = {}, route = 'image') => fetch(`${local}/api/provider/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, prompt: 'edit the original', size: '1536x1024', quality: 'standard', referenceImage: { assetId: asset.id }, ...extra }),
  });
  try {
    await t.test('sends original bytes, multipart boundary, auth and mapped GPT Image quality', async () => {
      const response = await post();
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { url: 'data:image/png;base64,cGljdHVyZQ==', revisedPrompt: 'edited' });
      assert.equal(calls.length, 1);
      const call = calls[0];
      assert.equal(call.path, '/v1/images/edits');
      assert.equal(call.headers.authorization, 'Bearer test-only-key');
      const contentType = String(call.headers['content-type']);
      assert.match(contentType, /^multipart\/form-data; boundary=/);
      const form = await new Response(new Uint8Array(call.body), { headers: { 'content-type': contentType } }).formData();
      assert.equal(form.get('model'), 'gpt-image-2');
      assert.equal(form.get('prompt'), 'edit the original');
      assert.equal(form.get('size'), '1536x1024');
      assert.equal(form.get('quality'), 'medium');
      assert.equal(form.get('n'), '1');
      assert.equal(form.has('response_format'), false);
      const image = form.get('image') as File;
      assert.equal(image.type, 'image/png');
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), original);
    });
    await t.test('canvas parameters are validated before a paid hop and use normalized wire values', async () => {
      const before = calls.length;
      for (const canvasParameters of [null, [], 'invalid', { aspectRatio: '21:9' }, { quality: 'ultra' }]) {
        assert.equal((await post({ canvasParameters })).status, 400);
      }
      assert.equal(calls.length, before);
      assert.equal((await post({ canvasParameters: { aspectRatio: '9:16', quality: 'hd' }, size: 'invalid', quality: 'invalid' })).status, 200);
      const call = calls.at(-1)!;
      const form = await new Response(new Uint8Array(call.body), { headers: { 'content-type': String(call.headers['content-type']) } }).formData();
      assert.equal(form.get('size'), '1024x1536');
      assert.equal(form.get('quality'), 'high');
      assert.equal(calls.length, before + 1);
    });
    await t.test('JPEG and WebP are sent unchanged with detected MIME, not a filename-derived MIME', async () => {
      for (const format of ['jpeg', 'webp'] as const) {
        const bytes = await sharp(original).toFormat(format).toBuffer();
        await fs.writeFile(originalPath, bytes);
        assert.equal((await post()).status, 200);
        const call = calls.at(-1)!;
        const form = await new Response(new Uint8Array(call.body), { headers: { 'content-type': String(call.headers['content-type']) } }).formData();
        const image = form.get('image') as File;
        assert.equal(image.type, `image/${format}`);
        assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
      }
      await fs.writeFile(originalPath, original);
    });
    await t.test('hd maps to high and URL results are preserved with a stored key', async () => {
      await store.saveProvider('saved', {
        id: 'saved', name: 'test', protocol: 'chat-completions', baseUrl, apiKey: config.apiKey,
        models: [{ id: 'gpt-image-1.5', categories: ['image'] }], selectedModels: { image: 'gpt-image-1.5' },
      });
      payload = { data: [{ url: 'https://example.invalid/edited.png' }] };
      const response = await post({ quality: 'hd', config: { ...config, protocol: 'chat-completions', model: 'gpt-image-1.5', apiKey: '', storedKey: { providerId: 'saved', scope: 'provider' } } });
      assert.equal(response.status, 200);
      assert.equal((await response.json() as { url: string }).url, 'https://example.invalid/edited.png');
      const call = calls.at(-1)!;
      assert.equal(call.headers.authorization, `Bearer ${config.apiKey}`);
      const form = await new Response(new Uint8Array(call.body), { headers: { 'content-type': String(call.headers['content-type']) } }).formData();
      assert.equal(form.get('quality'), 'high');
    });
    await t.test('upstream errors, empty output and invalid JSON shape never retry or fall back', async () => {
      for (const [code, body] of [[401, { error: { message: 'denied test-only-key' } }], [429, { error: { message: 'rate limited' } }], [500, { error: { message: 'unavailable' } }], [200, {}]] as const) {
        status = code; payload = body;
        const before = calls.length;
        const response = await post();
        assert.equal(response.status, code === 200 ? 500 : code);
        assert.equal(calls.length, before + 1);
        assert.equal(calls.at(-1)?.path, '/v1/images/edits');
        const result = await response.json() as { error: string };
        assert.equal(result.error.includes('test-only-key'), false);
      }
    });
    await t.test('invalid references, paths, URLs, deleted/missing/wrong-type assets and unknown protocols/models never reach upstream', async () => {
      const video = assets.create({ type: 'video', title: 'video' });
      const deleted = assets.create({ type: 'image', title: 'deleted' });
      assets.softDelete(deleted.id);
      const noFile = assets.create({ type: 'image', title: 'no file', sourceUrl: 'https://example.invalid/no-fetch.png' });
      const before = calls.length;
      for (const referenceImage of [null, {}, 'file:///etc/passwd', { assetId: '/etc/passwd' }, { assetId: 'https://example.invalid/a' }, { assetId: asset.id, path: '/etc/passwd' }, { assetId: asset.id, url: 'http://localhost/private' }, { assetId: video.id }, { assetId: deleted.id }, { assetId: noFile.id }]) {
        assert.ok((await post({ referenceImage })).status >= 400);
      }
      for (const model of ['gpt-image-1', 'dall-e-3', 'unknown-image-model']) {
        assert.ok((await post({ config: { ...config, model } })).status >= 400);
      }
      assert.ok((await post({ config: { ...config, protocol: 'anthropic-messages' } })).status >= 400);
      assert.equal((await post({}, 'video')).status, 400);
      assert.ok((await post({ size: '123x123' })).status >= 400);
      assert.ok((await post({ quality: 'made-up' })).status >= 400);
      assert.equal(calls.length, before);
    });
    await t.test('corrupt, oversize and removed originals fail before billing', async () => {
      const before = calls.length;
      await fs.writeFile(originalPath, 'not an image');
      assert.equal((await post()).status, 400);
      await fs.truncate(originalPath, 10 * 1024 * 1024 + 1);
      assert.equal((await post()).status, 400);
      await fs.unlink(originalPath);
      assert.equal((await post()).status, 404);
      assert.equal(calls.length, before);
    });
    await t.test('text-only generation stays on the JSON generations route', async () => {
      status = 200; payload = { data: [{ url: 'https://example.invalid/generated.png' }] };
      const response = await post({ referenceImage: undefined, config: { ...config, model: 'existing-vendor-model' } });
      assert.equal(response.status, 200);
      assert.equal(calls.at(-1)?.path, '/v1/images/generations');
      assert.equal(calls.at(-1)?.headers['content-type'], 'application/json');
    });
    assert.equal(normalizeOpenAiBaseUrl(`${baseUrl}/images/edits`), baseUrl);
  } finally {
    server.closeAllConnections(); upstream.closeAllConnections();
    await Promise.all([new Promise<void>((resolve) => server.close(() => resolve())), new Promise<void>((resolve) => upstream.close(() => resolve()))]);
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
