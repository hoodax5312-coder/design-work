import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import sharp from 'sharp';
import { createAssetRouter } from './assetGateway';
import { openLibraryDatabase } from './database';
import { createLibraryPaths } from './libraryPaths';
import type { LibraryRuntime } from './libraryRuntime';
import { AssetRepository } from './repositories/AssetRepository';

test('canvas original images use registered files, detected formats and uncached original bytes', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lizuo-image-original-'));
  const database = openLibraryDatabase(':memory:');
  const assets = new AssetRepository(database);
  const runtime = { database, assets, paths: createLibraryPaths(root) } as LibraryRuntime;
  const app = express();
  const errors: unknown[] = [];
  let removeBeforeSend = false;
  app.use((_request, response, next) => {
    const sendFile = response.sendFile.bind(response);
    response.sendFile = ((filePath: string, ...args: unknown[]) => {
      if (removeBeforeSend) {
        removeBeforeSend = false;
        const callback = args.at(-1) as (error?: Error) => void;
        args[args.length - 1] = (error?: Error) => {
          if (error) errors.push(error);
          callback(error);
        };
        void fs.unlink(filePath).then(() => Reflect.apply(sendFile, response, [filePath, ...args]));
        return;
      }
      return Reflect.apply(sendFile, response, [filePath, ...args]);
    }) as typeof response.sendFile;
    next();
  });
  app.use('/api/assets', createAssetRouter(async () => runtime));
  app.use((error: Error & { status?: number }, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    errors.push(error);
    response.status(error.status || 500).json({ error: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  });
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/assets`;
  const original = sharp({ create: { width: 73, height: 41, channels: 3, background: '#abc123' } });
  let fileIndex = 0;
  const register = async (bytes: Buffer, title = 'original.png') => {
    const filePath = path.join(root, `${fileIndex++}.png`);
    await fs.writeFile(filePath, bytes);
    const asset = assets.create({ type: 'image', title, fileReference: {
      absolutePath: filePath, fileName: 'misleading.png', extension: 'png', mimeType: 'image/png', fileSize: bytes.length,
    } });
    return { asset, filePath };
  };

  for (const format of ['png', 'jpeg', 'webp'] as const) {
    await t.test(`${format}: MIME, safe download extension and exact original bytes`, async () => {
      const bytes = await original.clone().toFormat(format).toBuffer();
      const { asset } = await register(bytes, '../unsafe\\name\r\n".png');
      for (const suffix of ['', '?download=1', '?download=0']) {
        const response = await fetch(`${url}/${asset.id}/original${suffix}`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-type'), `image/${format}`);
        assert.match(String(response.headers.get('cache-control')), /no-store/);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
        if (suffix === '?download=1') {
          const disposition = response.headers.get('content-disposition')!;
          assert.match(disposition, /^attachment; filename=/);
          assert.ok(disposition.endsWith(`${format === 'jpeg' ? '.jpg' : `.${format}`}"`));
          assert.doesNotMatch(disposition, /[\r\n/\\]/);
        } else {
          assert.equal(response.headers.get('content-disposition'), null);
        }
      }
    });
  }

  await t.test('SVG originals retain bytes with restrictive document headers', async () => {
    const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="90" height="30"><rect width="90" height="30" fill="red"/></svg>');
    const { asset } = await register(bytes, 'vector.png');
    const response = await fetch(`${url}/${asset.id}/original?download=1`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type')!, /^image\/svg\+xml/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy')!, /sandbox; default-src 'none'/);
    assert.match(response.headers.get('content-disposition')!, /vector.svg/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  });

  await t.test('Unicode download names are safely encoded', async () => {
    const { asset } = await register(await original.clone().jpeg().toBuffer(), '\u539f\u56fe.png');
    const response = await fetch(`${url}/${asset.id}/original?download=1`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition')!, /filename\*=UTF-8''%E5%8E%9F%E5%9B%BE.jpg/);
    await response.arrayBuffer();
  });

  await t.test('missing assets/references/files, deleted assets and non-images fail closed', async () => {
    const noFile = assets.create({ type: 'image', title: 'no file' });
    const audio = assets.create({ type: 'audio', title: 'audio' });
    const { asset, filePath } = await register(await original.clone().png().toBuffer());
    await fs.unlink(filePath);
    for (const id of ['missing', noFile.id, asset.id]) {
      assert.equal((await fetch(`${url}/${id}/original`)).status, 404);
    }
    assert.equal((await fetch(`${url}/${audio.id}/original`)).status, 400);
    const saved = await register(await original.clone().png().toBuffer());
    const before = await fetch(`${url}/${saved.asset.id}/original`);
    const etag = before.headers.get('etag')!;
    const modified = before.headers.get('last-modified')!;
    assert.match(before.headers.get('cache-control')!, /no-store/);
    await before.arrayBuffer();
    assets.softDelete(saved.asset.id);
    const after = await fetch(`${url}/${saved.asset.id}/original?download=1`, {
      headers: { 'If-None-Match': etag, 'If-Modified-Since': modified },
    });
    assert.equal(after.status, 404);
    assert.match(after.headers.get('cache-control')!, /no-store/);
  });

  await t.test('query paths cannot override the registered original', async () => {
    const bytes = await original.clone().webp().toBuffer();
    const { asset } = await register(bytes);
    const otherPath = path.join(root, 'private.png');
    await fs.writeFile(otherPath, 'not the registered original');
    const query = new URLSearchParams({ path: otherPath, filePath: otherPath, absolutePath: otherPath });
    const response = await fetch(`${url}/${asset.id}/original?${query}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.equal((await fetch(`${url}/missing/original?${query}`)).status, 404);
  });

  await t.test('directories are not served, and sendFile failures reach error middleware', async () => {
    const { asset, filePath } = await register(await original.clone().png().toBuffer());
    await fs.unlink(filePath);
    await fs.mkdir(filePath);
    assert.equal((await fetch(`${url}/${asset.id}/original`)).status, 404);
    await fs.rmdir(filePath);
    await fs.writeFile(filePath, await original.clone().png().toBuffer());
    const previousErrors = errors.length;
    removeBeforeSend = true;
    assert.equal((await fetch(`${url}/${asset.id}/original`)).status, 404);
    assert.equal(errors.length, previousErrors + 1);
  });
});
