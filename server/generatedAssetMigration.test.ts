import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { openLibraryDatabase } from './database';
import { migrateLegacyGeneratedAssets } from './generatedAssetMigration';
import { createLibraryPaths, ensureLibraryDirectories } from './libraryPaths';
import { PreviewService } from './previews/PreviewService';
import { AssetRepository } from './repositories/AssetRepository';

test('restores legacy inline generated images and is idempotent', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'design-work-generated-migration-'));
  const paths = createLibraryPaths(path.join(directory, 'data'), path.join(directory, 'cache'));
  await ensureLibraryDirectories(paths);
  const database = openLibraryDatabase(paths.database);
  const assets = new AssetRepository(database);
  const previews = new PreviewService(database, paths);
  const assetId = 'legacy-inline-image';
  const source = await sharp({
    create: { width: 32, height: 20, channels: 3, background: '#4b5563' },
  }).png().toBuffer();
  const sourceUrl = `data:image/png;base64,${source.toString('base64')}`;
  assets.create({
    id: assetId,
    type: 'image',
    title: '历史生成图',
    userMetadata: { source: 'image-generation', generatedUrl: sourceUrl },
  });

  try {
    const first = await migrateLegacyGeneratedAssets({ database, paths, assets, previews });
    assert.deepEqual(first, { scanned: 1, restored: 1, markedUnrecoverable: 0, skipped: 0 });
    const reference = database
      .prepare('SELECT * FROM file_references WHERE asset_id = ?')
      .get(assetId) as Record<string, unknown>;
    assert.equal(reference.status, 'online');
    assert.deepEqual(await fs.readFile(String(reference.absolute_path)), source);
    assert.equal(await fs.stat(String(reference.absolute_path)).then(() => true), true);
    assert.equal(previews.repository.latest(assetId, 'thumbnail:512')?.status, 'ready');
    assert.equal(assets.get(assetId)?.userMetadata.generatedSourceStatus, 'restored');

    const second = await migrateLegacyGeneratedAssets({ database, paths, assets, previews });
    assert.deepEqual(second, { scanned: 0, restored: 0, markedUnrecoverable: 0, skipped: 0 });
    assert.equal(
      database.prepare('SELECT COUNT(*) AS count FROM file_references WHERE asset_id = ?').get(assetId)?.count,
      1,
    );
  } finally {
    database.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('marks expired signed image URLs unrecoverable without downloading them', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'design-work-expired-migration-'));
  const paths = createLibraryPaths(path.join(directory, 'data'), path.join(directory, 'cache'));
  await ensureLibraryDirectories(paths);
  const database = openLibraryDatabase(paths.database);
  const assets = new AssetRepository(database);
  const previews = new PreviewService(database, paths);
  const assetId = 'legacy-expired-image';
  const expiredUrl = 'https://pre-signed-firefly-prod.s3.amazonaws.com/image.png?X-Amz-Date=20200101T000000Z&X-Amz-Expires=60';
  assets.create({
    id: assetId,
    type: 'image',
    title: '过期历史生成图',
    userMetadata: { source: 'image-generation', generatedUrl: expiredUrl },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('过期签名地址不应发起网络请求');
  };

  try {
    const result = await migrateLegacyGeneratedAssets({ database, paths, assets, previews });
    assert.deepEqual(result, { scanned: 1, restored: 0, markedUnrecoverable: 1, skipped: 0 });
    const metadata = assets.get(assetId)?.userMetadata || {};
    assert.equal(metadata.generatedSourceStatus, 'unrecoverable');
    assert.equal(metadata.generatedSourceError, '原图签名地址已过期');
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM file_references WHERE asset_id = ?').get(assetId)?.count, 0);
  } finally {
    globalThis.fetch = originalFetch;
    database.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
