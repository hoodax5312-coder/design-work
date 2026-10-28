import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { createAssetRouter } from './assetGateway';
import { sniffAudioFormat } from './audioAssetStorage';
import { openLibraryDatabase } from './database';
import { createLibraryPaths } from './libraryPaths';
import type { LibraryRuntime } from './libraryRuntime';
import { AssetRepository } from './repositories/AssetRepository';
import { createProviderConfigStore } from './providerConfigStore';
import { createProviderRouter } from './providerGateway';
import { assertMusicModelSupported, clampMusicSeconds, musicModelCapability } from '../src/lib/musicModels';
import { audioMediaUrl, composeMusicPrompt, defaultNodeData, normalizeRestoredCanvas, type CanvasEdgeLike, type CanvasNodeLike } from '../src/components/canvas/canvasModel';

// 合成的最小 MP3/WAV 文件头，只用于格式识别与存储链路，不调用任何真实供应商。
const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.from([3, 0, 0, 0, 0, 0, 0]), Buffer.alloc(64, 1)]);
const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(32)]);

const listen = async (app: express.Express) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
};

const setup = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lizuo-audio-'));
  const database = openLibraryDatabase(':memory:');
  // 预览服务只用于图片缩略图；音频链路只需要它能回答"没有预览"。
  const previews = { repository: { latest: () => undefined } };
  const runtime = { database, assets: new AssetRepository(database), paths: createLibraryPaths(root), previews } as unknown as LibraryRuntime;
  return { root, runtime };
};

test('audio format sniffing uses file headers, not names', () => {
  assert.equal(sniffAudioFormat(mp3), 'mp3');
  assert.equal(sniffAudioFormat(wav), 'wav');
  assert.equal(sniffAudioFormat(Buffer.from('OggS00000000000')), 'ogg');
  assert.equal(sniffAudioFormat(Buffer.from('<html>not audio</html>')), null);
  assert.equal(sniffAudioFormat(Buffer.alloc(4)), null);
});

test('music capability registry only exposes documented parameters', () => {
  const capability = musicModelCapability('LingShan-MU-11');
  assert.ok(capability);
  assert.equal(capability.lyrics, false);
  assert.equal(capability.referenceAudio, false);
  assert.equal(clampMusicSeconds(1, capability), 3);
  assert.equal(clampMusicSeconds(9999, capability), 600);
  assert.throws(() => assertMusicModelSupported('responses', 'tts-1'), /没有已实现的音乐生成协议/);
  assert.throws(() => assertMusicModelSupported('anthropic-messages', 'LingShan-MU-11'), /没有已实现/);
});

test('music prompt composes structured fields; restored audio nodes keep asset references', () => {
  assert.equal(composeMusicPrompt({ musicStyle: '电子', musicMood: ' 明快 ', prompt: '产品片头' }), '风格：电子\n情绪：明快\n用途与描述：产品片头');
  assert.equal(composeMusicPrompt({ prompt: '只有描述' }), '只有描述');
  assert.equal(composeMusicPrompt(defaultNodeData('audio')), '');
  const restored = normalizeRestoredCanvas<CanvasNodeLike, CanvasEdgeLike>({ nodes: [
    { id: 'a', type: 'audio', position: { x: 0, y: 0 }, data: { audioAssetId: 'x', audioUrl: audioMediaUrl('x'), uploading: true } },
    { id: 'b', type: 'audio', position: { x: 0, y: 0 }, data: { audioUrl: 'blob:http://localhost/old' } },
  ], edges: [] }, () => false, () => false);
  assert.equal(restored.nodes[0].data.audioUrl, '/api/assets/x/media');
  assert.equal(restored.nodes[0].data.uploading, false);
  assert.equal(restored.nodes[0].width, 360);
  assert.equal(restored.nodes[1].data.audioUrl, undefined);
  assert.match(String(restored.nodes[1].data.error), /失效/);
});

test('audio upload stores validated bytes and serves them with range support', async (t) => {
  const { runtime } = await setup();
  const app = express();
  app.use(express.json());
  app.use('/api/assets', createAssetRouter(async () => runtime));
  const { server, url } = await listen(app);
  t.after(() => server.close());
  const upload = (body: Buffer, name: string) => fetch(`${url}/api/assets/audio`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-lizuo-file-name': encodeURIComponent(name) }, body: new Uint8Array(body),
  });

  const created = await upload(mp3, '配乐 demo.mp3');
  assert.equal(created.status, 201, await created.clone().text());
  const asset = await created.json() as { id: string; type: string; title: string; userMetadata: Record<string, unknown> };
  assert.equal(asset.type, 'audio');
  assert.equal(asset.title, '配乐 demo.mp3');
  assert.equal(asset.userMetadata.source, 'local-upload');

  const media = await fetch(`${url}/api/assets/${asset.id}/media`);
  assert.equal(media.status, 200);
  assert.match(String(media.headers.get('content-type')), /^audio\/mpeg/);
  assert.deepEqual(Buffer.from(await media.arrayBuffer()), mp3);
  const ranged = await fetch(`${url}/api/assets/${asset.id}/media`, { headers: { Range: 'bytes=0-2' } });
  assert.equal(ranged.status, 206);
  assert.equal(Buffer.from(await ranged.arrayBuffer()).toString(), 'ID3');

  assert.equal((await upload(Buffer.from('<html>fake</html>'.padEnd(40)), 'fake.mp3')).status, 400);
  assert.equal((await upload(mp3, 'notes.txt')).status, 400);
  assert.equal((await upload(Buffer.alloc(0), 'empty.mp3')).status, 400);

  const image = runtime.assets.create({ type: 'image', title: 'img' });
  assert.equal((await fetch(`${url}/api/assets/${image.id}/media`)).status, 400);
  assert.equal((await fetch(`${url}/api/assets/missing/media`)).status, 404);
  runtime.assets.softDelete(asset.id);
  assert.equal((await fetch(`${url}/api/assets/${asset.id}/media`)).status, 404);
});

test('music route: registered protocol only, single request, result stored as asset, no key leak', async (t) => {
  const { root, runtime } = await setup();
  const calls: Array<{ path: string; body: Record<string, unknown>; auth: unknown }> = [];
  let reply: (res: express.Response) => void = (res) => res.type('audio/mpeg').send(mp3);
  const upstreamApp = express();
  upstreamApp.use(express.json());
  upstreamApp.get('/files/song.wav', (_req, res) => res.type('audio/wav').send(wav));
  upstreamApp.post('/v1/audio/speech', (req, res) => {
    calls.push({ path: req.path, body: req.body, auth: req.headers.authorization });
    reply(res);
  });
  const upstream = await listen(upstreamApp);
  const app = express();
  app.use(express.json());
  app.use('/api/provider', createProviderRouter(createProviderConfigStore(path.join(root, 'providers.json')), async () => runtime));
  const local = await listen(app);
  t.after(() => { upstream.server.close(); local.server.close(); });
  const key = 'test-only-music-key-0123456789abcdef';
  const config = { category: 'music', protocol: 'responses', baseUrl: `${upstream.url}/v1`, apiKey: key, model: 'LingShan-MU-11' };
  const post = (extra: Record<string, unknown> = {}) => fetch(`${local.url}/api/provider/music`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, prompt: '风格：电子\n用途与描述：片头', durationSeconds: 30, instrumental: false, ...extra }),
  });

  const ok = await post();
  assert.equal(ok.status, 200);
  const result = await ok.json() as { assetId: string; mimeType: string; requestedSeconds: number; instrumental: boolean };
  assert.equal(result.mimeType, 'audio/mpeg');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].auth, `Bearer ${key}`);
  assert.deepEqual(calls[0].body, {
    model: 'LingShan-MU-11', input: '风格：电子\n用途与描述：片头', response_format: 'mp3',
    metadata: { music_length_ms: 30000, force_instrumental: false, respect_sections_durations: true, output_format: 'mp3_44100_128' },
  });
  const stored = runtime.assets.get(result.assetId);
  assert.equal(stored?.type, 'audio');
  assert.equal(stored?.userMetadata?.source, 'canvas');
  assert.equal(stored?.userMetadata?.kind, 'music');

  reply = (res) => res.json({ data: [{ url: `${upstream.url}/files/song.wav` }] });
  const viaUrl = await post();
  assert.equal(viaUrl.status, 200);
  assert.equal((await viaUrl.json() as { mimeType: string }).mimeType, 'audio/wav');

  const before = calls.length;
  for (const [extra, pattern] of [
    [{ config: { ...config, model: 'tts-1' } }, /没有已实现的音乐生成协议/],
    [{ config: { ...config, category: 'video' } }, /音乐类型/],
    [{ prompt: '  ' }, /音乐描述/],
    [{ durationSeconds: 1 }, /时长/],
    [{ durationSeconds: 601 }, /时长/],
  ] as const) {
    const response = await post(extra);
    assert.equal(response.status, 400);
    assert.match((await response.json() as { error: string }).error, pattern);
  }
  assert.equal(calls.length, before, 'invalid requests must not reach the paid upstream');

  for (const [respond, status, pattern] of [
    [(res: express.Response) => res.status(402).json({ error: { message: `quota exceeded for ${key}` } }), 402, /quota exceeded/],
    [(res: express.Response) => res.json({ data: [] }), 502, /没有返回音频/],
    [(res: express.Response) => res.type('text/html').send('<html>not audio at all</html>'), 502, /保存到本机资产库失败/],
  ] as const) {
    reply = respond;
    const count: number = calls.length;
    const response = await post();
    assert.equal(response.status, status);
    const error = (await response.json() as { error: string }).error;
    assert.match(error, pattern);
    assert.equal(error.includes(key), false);
    assert.equal(calls.length, count + 1, 'failures are not retried');
  }
});
