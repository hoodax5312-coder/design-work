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
    const filtered = await filteredResponse.json() as {
      items: Array<{ id: string }>;
      total: number;
      counts: { all: number; unfiled: number; byType: Record<string, number> };
    };
    assert.equal(filtered.total, 1);
    assert.equal(filtered.items[0].id, match.id);
    assert.deepEqual(filtered.counts, {
      all: 2,
      unfiled: 1,
      byType: { image: 1, video: 1, audio: 0 },
    });

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

test('asset API separates source categories and persists favorites on creation', async () => {
  const runtime = createRuntime();
  const generatedImage = runtime.assets.create({
    type: 'image',
    title: 'Generated image',
    userMetadata: { source: 'image-generation' },
  });
  const generatedVideo = runtime.assets.create({
    type: 'video',
    title: 'Generated video',
    userMetadata: { source: 'video-generation' },
  });
  const canvasAsset = runtime.assets.create({
    type: 'image',
    title: 'Canvas image',
    userMetadata: { source: 'canvas' },
  });
  const uploadedAsset = runtime.assets.create({
    type: 'audio',
    title: 'Uploaded audio',
    userMetadata: { source: 'local-upload' },
  });
  const legacyUploadedAsset = runtime.assets.create({ type: 'image', title: 'Legacy upload' });
  const caseAsset = runtime.assets.create({
    type: 'video',
    title: 'Favorite case',
    favorite: true,
    userMetadata: { source: 'case-library', caseId: 'case-1' },
  });

  const app = express();
  app.use(express.json());
  app.use('/api/assets', createAssetRouter(async () => runtime));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const readIds = async (query: string) => {
      const response = await fetch(`${origin}/api/assets?${query}`);
      assert.equal(response.status, 200);
      const page = await response.json() as { items: Array<{ id: string }> };
      return new Set(page.items.map((item) => item.id));
    };

    assert.deepEqual(
      await readIds('origin=generated'),
      new Set([generatedImage.id, generatedVideo.id]),
    );
    assert.deepEqual(await readIds('origin=canvas'), new Set([canvasAsset.id]));
    assert.deepEqual(
      await readIds('origin=uploaded'),
      new Set([uploadedAsset.id, legacyUploadedAsset.id]),
    );
    assert.deepEqual(await readIds('favorite=true'), new Set([caseAsset.id]));

    const createResponse = await fetch(`${origin}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'video',
        title: 'Collected generation',
        favorite: true,
        sourceUrl: 'https://example.com/generated.mp4',
        userMetadata: {
          source: 'video-generation',
          generatedUrl: 'https://example.com/generated.mp4',
        },
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as { id: string; favorite: boolean };
    assert.equal(created.favorite, true);
    assert.equal(runtime.assets.get(created.id)?.favorite, true);
    assert.equal((await readIds('origin=generated')).has(created.id), true);
    assert.equal((await readIds('favorite=true')).has(created.id), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    runtime.database.close();
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

test('asset API reveals and exports the original file without overwriting or leaving the chosen folder', async () => {
  const runtime = createRuntime();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'design-work-asset-export-'));
  const sourcePath = path.join(root, 'library', 'generated.png');
  const exportDirectory = path.join(root, 'export');
  await fs.mkdir(path.dirname(sourcePath), { recursive: true });
  await fs.mkdir(exportDirectory);
  await fs.writeFile(sourcePath, 'png-bytes');
  const fileReference = {
    absolutePath: sourcePath,
    volumeId: 'test',
    fileName: 'generated.png',
    extension: 'png',
    mimeType: 'image/png',
    fileSize: 9,
    fileCreatedAt: Date.now(),
    fileModifiedAt: Date.now(),
    contentHash: 'hash-export',
  };
  // 标题里的路径分隔符不能让导出写到所选文件夹之外。
  const asset = runtime.assets.create({ type: 'image', title: '../橙子/海报', fileReference });
  const missing = runtime.assets.create({
    type: 'image',
    title: 'Moved away',
    fileReference: { ...fileReference, absolutePath: path.join(root, 'gone.png'), contentHash: 'hash-gone' },
  });
  const noFile = runtime.assets.create({ type: 'image', title: 'Remote only' });

  const revealed: string[] = [];
  let pickedDirectory: string | null = exportDirectory;
  const app = express();
  app.use(express.json());
  app.use(
    '/api/assets',
    createAssetRouter(
      async () => runtime,
      { pickFiles: async () => [], pickDirectory: async () => pickedDirectory },
      undefined,
      async (filePath) => { revealed.push(filePath); },
    ),
  );
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = (url: string) => fetch(`${origin}${url}`, { method: 'POST' });

    assert.equal((await post(`/api/assets/${asset.id}/reveal`)).status, 200);
    assert.deepEqual(revealed, [sourcePath]);

    const first = await (await post(`/api/assets/${asset.id}/export`)).json() as { cancelled: boolean; path: string };
    const second = await (await post(`/api/assets/${asset.id}/export`)).json() as { cancelled: boolean; path: string };
    assert.equal(first.cancelled, false);
    assert.equal(path.dirname(first.path), exportDirectory);
    assert.equal(path.basename(first.path), '橙子 海报.png');
    assert.equal(path.basename(second.path), '橙子 海报 2.png');
    assert.equal(await fs.readFile(first.path, 'utf8'), 'png-bytes');
    assert.equal(await fs.readFile(sourcePath, 'utf8'), 'png-bytes');

    pickedDirectory = null;
    assert.deepEqual(await (await post(`/api/assets/${asset.id}/export`)).json(), { cancelled: true });
    assert.deepEqual((await fs.readdir(exportDirectory)).sort(), ['橙子 海报 2.png', '橙子 海报.png']);

    for (const [id, message] of [
      [missing.id, /原文件已不在保存位置/],
      [noFile.id, /没有保存到本地的文件/],
      ['not-an-asset', /资产不存在/],
    ] as const) {
      for (const action of ['reveal', 'export']) {
        const response = await post(`/api/assets/${id}/${action}`);
        assert.equal(response.status, 404);
        assert.match(((await response.json()) as { error: string }).error, message);
      }
    }
    assert.deepEqual(revealed, [sourcePath]);
  } finally {
    server.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
