import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import sharp from 'sharp';
import { createAssetRouter } from './assetGateway';
import { openLibraryDatabase } from './database';
import { ImportService } from './import/ImportService';
import { FingerprintService } from './import/FingerprintService';
import { createLibraryPaths, ensureLibraryDirectories } from './libraryPaths';
import type { LibraryRuntime } from './libraryRuntime';
import { PreviewService } from './previews/PreviewService';
import { AssetRepository } from './repositories/AssetRepository';
import { FolderRepository } from './repositories/FolderRepository';
import { SmartCollectionRepository, compileSmartCollectionRules } from './repositories/SmartCollectionRepository';
import { TagRepository } from './repositories/TagRepository';
import { TaskRepository } from './repositories/TaskRepository';
import { TaskRunner } from './tasks/TaskRunner';

const createRuntime = (): LibraryRuntime => {
  const database = openLibraryDatabase(':memory:');
  const paths = createLibraryPaths('/tmp/design-work-asset-api-test');
  return {
    database,
    paths,
    tasks: new TaskRunner(new TaskRepository(database)),
    imports: new ImportService(database),
    assets: new AssetRepository(database),
    folders: new FolderRepository(database),
    tags: new TagRepository(database),
    smartCollections: new SmartCollectionRepository(database),
    previews: new PreviewService(database, paths),
  };
};

test('asset API supports combined filters, durable updates, bulk operations, delete and restore', async () => {
  const runtime = createRuntime();
  const filesDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'design-work-relocate-'));
  const originalPath = path.join(filesDirectory, 'original.png');
  const relocatedPath = path.join(filesDirectory, 'relocated.png');
  await fs.writeFile(originalPath, 'same-file-content');
  await fs.copyFile(originalPath, relocatedPath);
  const folder = runtime.folders.create('城市参考');
  const cityTag = runtime.tags.create('城市');
  const nightTag = runtime.tags.create('夜景');
  const match = runtime.assets.create({
    type: 'image',
    title: 'Neon Shanghai',
    description: 'cinematic street',
    favorite: true,
    rating: 5,
    primaryFolderId: folder.id,
    extractedText: 'volumetric lighting',
  });
  const other = runtime.assets.create({ type: 'video', title: 'Day street', rating: 2 });
  runtime.tags.bulkAttach([match.id], [cityTag, nightTag]);
  runtime.tags.attach(other.id, cityTag);
  const originalStat = await fs.stat(originalPath);
  const referenceId = 'reference-relocate';
  runtime.database
    .prepare(`
      INSERT INTO file_references(
        id, asset_id, absolute_path, file_name, extension, file_size,
        file_created_at, file_modified_at, content_hash, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, '.png', ?, ?, ?, ?, 'changed', 1, 1)
    `)
    .run(
      referenceId,
      match.id,
      originalPath,
      'original.png',
      originalStat.size,
      Math.trunc(originalStat.birthtimeMs),
      Math.trunc(originalStat.mtimeMs),
      await new FingerprintService().full(originalPath),
    );

  const app = express();
  app.use(express.json());
  app.use(
    '/api/assets',
    createAssetRouter(async () => runtime, {
      pickFiles: async () => [relocatedPath],
      pickDirectory: async () => filesDirectory,
    }),
  );
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const filteredResponse = await fetch(
      `${origin}/api/assets?query=volumetric&type=image&tagId=${cityTag},${nightTag}&favorite=true&ratingMin=4&folderId=${folder.id}`,
    );
    const filtered = await filteredResponse.json() as { items: Array<{ id: string }>; total: number };
    assert.equal(filtered.total, 1);
    assert.equal(filtered.items[0].id, match.id);

    const updatedResponse = await fetch(`${origin}/api/assets/${match.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Shanghai after rain', description: 'wet neon road', rating: 4 }),
    });
    assert.equal(updatedResponse.status, 200);
    assert.equal(runtime.assets.get(match.id)?.title, 'Shanghai after rain');
    assert.deepEqual(runtime.assets.search({ query: 'wet' }).map((asset) => asset.id), [match.id]);

    await fetch(`${origin}/api/assets/bulk/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds: [other.id], favorite: true }),
    });
    await fetch(`${origin}/api/assets/bulk/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds: [other.id], folderId: folder.id }),
    });
    assert.equal(runtime.assets.get(other.id)?.favorite, true);
    assert.equal(runtime.assets.get(other.id)?.primaryFolderId, folder.id);

    const relocateResponse = await fetch(
      `${origin}/api/assets/${match.id}/files/${referenceId}/relocate`,
      { method: 'POST' },
    );
    assert.equal(relocateResponse.status, 200);
    assert.equal(
      runtime.database.prepare('SELECT absolute_path FROM file_references WHERE id = ?').get(referenceId)
        ?.absolute_path,
      relocatedPath,
    );

    assert.equal((await fetch(`${origin}/api/assets/${match.id}`, { method: 'DELETE' })).status, 204);
    assert.equal(runtime.assets.search().some((asset) => asset.id === match.id), false);
    assert.equal((await fetch(`${origin}/api/assets/${match.id}/restore`, { method: 'POST' })).status, 200);
    assert.equal(runtime.assets.get(match.id)?.status, 'active');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    runtime.database.close();
    await fs.rm(filesDirectory, { recursive: true, force: true });
  }
});

test('saving a generated image stores a local source, creates a preview, and cleans invalid input', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'design-work-generated-'));
  const paths = createLibraryPaths(path.join(directory, 'library'));
  await ensureLibraryDirectories(paths);
  const database = openLibraryDatabase(paths.database);
  const runtime: LibraryRuntime = {
    database,
    paths,
    tasks: new TaskRunner(new TaskRepository(database)),
    imports: new ImportService(database),
    assets: new AssetRepository(database),
    folders: new FolderRepository(database),
    tags: new TagRepository(database),
    smartCollections: new SmartCollectionRepository(database),
    previews: new PreviewService(database, paths),
  };
  runtime.tasks.register('preview.image', async (input) => {
    const result = await runtime.previews.generateImage(String(input.assetId), 512);
    return { reused: result.reused };
  });

  const source = await sharp({
    create: { width: 24, height: 16, channels: 3, background: '#6b7280' },
  }).png().toBuffer();
  const sourceUrl = `data:image/png;base64,${source.toString('base64')}`;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/assets', createAssetRouter(async () => runtime));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const createResponse = await fetch(`${origin}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'image',
        title: '本地生成图',
        sourceUrl,
        userMetadata: { source: 'image-generation', generatedUrl: sourceUrl },
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as { id: string; previewStatus: string };
    const reference = runtime.database
      .prepare('SELECT * FROM file_references WHERE asset_id = ?')
      .get(created.id) as Record<string, unknown>;
    assert.equal(reference.status, 'online');
    assert.equal(await fs.stat(String(reference.absolute_path)).then(() => true), true);

    await runtime.tasks.waitForIdle();
    assert.equal(runtime.previews.repository.latest(created.id, 'thumbnail:512')?.status, 'ready');
    assert.equal(
      (await fetch(`${origin}/api/assets/${created.id}/preview?size=512`)).status,
      200,
    );

    const invalidResponse = await fetch(`${origin}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'image',
        title: '损坏图片',
        sourceUrl: 'data:image/png;base64,aW52YWxpZA==',
      }),
    });
    assert.equal(invalidResponse.status, 400);
    assert.equal(
      (runtime.database.prepare('SELECT COUNT(*) AS count FROM assets').get()?.count),
      1,
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('smart collection compiler only accepts allowlisted fields and operators', () => {
  const compiled = compileSmartCollectionRules({
    match: 'all',
    conditions: [
      { field: 'type', operator: 'eq', value: 'image' },
      { field: 'rating', operator: 'gte', value: 4 },
      { field: 'author', operator: 'contains', value: "O'Reilly%" },
    ],
  });
  assert.match(compiled.sql, /a\.type = \?/);
  assert.equal(compiled.sql.includes("O'Reilly"), false);
  assert.throws(() => compileSmartCollectionRules({
    match: 'all',
    conditions: [{ field: 'title; DROP TABLE assets; --' as 'type', operator: 'eq', value: 'x' }],
  }), /未允许/);
  assert.throws(() => compileSmartCollectionRules({
    match: 'all',
    conditions: [{ field: 'type', operator: 'contains', value: 'image' }],
  }), /不支持/);
});
