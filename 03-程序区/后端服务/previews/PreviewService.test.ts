import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { openLibraryDatabase } from '../database';
import { createLibraryPaths, ensureLibraryDirectories } from '../libraryPaths';
import { ImagePreviewProvider } from './ImagePreviewProvider';
import { PreviewService, PreviewSourceChangedError } from './PreviewService';

const withLibrary = async (
  run: (context: {
    directory: string;
    database: ReturnType<typeof openLibraryDatabase>;
    service: PreviewService;
  }) => Promise<void>,
) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'design-work-preview-'));
  const paths = createLibraryPaths(path.join(directory, 'library'));
  await ensureLibraryDirectories(paths);
  const database = openLibraryDatabase(paths.database);
  try {
    await run({ directory, database, service: new PreviewService(database, paths) });
  } finally {
    database.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
};

const registerImage = async (
  database: ReturnType<typeof openLibraryDatabase>,
  absolutePath: string,
) => {
  const id = randomUUID();
  const referenceId = randomUUID();
  const stat = await fs.stat(absolutePath);
  const now = Date.now();
  database
    .prepare(
      `
    INSERT INTO assets(
      id, type, title, status, raw_metadata, normalized_metadata, user_metadata,
      created_at, imported_at, updated_at
    ) VALUES (?, 'image', ?, 'active', '{}', '{}', '{}', ?, ?, ?)
  `,
    )
    .run(id, path.basename(absolutePath), now, now, now);
  database
    .prepare(
      `
    INSERT INTO file_references(
      id, asset_id, absolute_path, file_name, extension, file_size,
      file_created_at, file_modified_at, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?)
  `,
    )
    .run(
      referenceId,
      id,
      absolutePath,
      path.basename(absolutePath),
      path.extname(absolutePath),
      stat.size,
      Math.trunc(stat.birthtimeMs),
      Math.trunc(stat.mtimeMs),
      now,
      now,
    );
  return id;
};

test('generates oriented JPEG, PNG transparency and WebP previews', async () => {
  await withLibrary(async ({ directory, database, service }) => {
    const jpeg = path.join(directory, 'oriented.jpg');
    const png = path.join(directory, 'alpha.png');
    const webp = path.join(directory, 'source.webp');
    await sharp({ create: { width: 40, height: 20, channels: 3, background: '#e63946' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(jpeg);
    await sharp({
      create: {
        width: 32,
        height: 24,
        channels: 4,
        background: { r: 20, g: 40, b: 60, alpha: 0.4 },
      },
    })
      .png()
      .toFile(png);
    await sharp({ create: { width: 18, height: 18, channels: 3, background: '#3a86ff' } })
      .webp()
      .toFile(webp);

    const jpegResult = await service.generateImage(await registerImage(database, jpeg), 512);
    const pngResult = await service.generateImage(await registerImage(database, png), 256);
    const webpResult = await service.generateImage(await registerImage(database, webp), 256);
    const jpegMetadata = await sharp(jpegResult.absolutePath).metadata();
    const pngMetadata = await sharp(pngResult.absolutePath).metadata();
    assert.equal(jpegMetadata.width, 20);
    assert.equal(jpegMetadata.height, 40);
    assert.equal(pngMetadata.hasAlpha, true);
    assert.equal((await sharp(webpResult.absolutePath).metadata()).format, 'webp');
  });
});

test('reuses a valid cache and marks it stale after the source changes', async () => {
  await withLibrary(async ({ directory, database, service }) => {
    const source = path.join(directory, 'source.png');
    await sharp({ create: { width: 20, height: 20, channels: 3, background: '#111111' } })
      .png()
      .toFile(source);
    const assetId = await registerImage(database, source);
    const first = await service.generateImage(assetId, 256);
    const second = await service.generateImage(assetId, 256);
    assert.equal(second.reused, true);
    assert.equal(first.absolutePath, second.absolutePath);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await sharp({ create: { width: 30, height: 20, channels: 3, background: '#ffffff' } })
      .png()
      .toFile(source);
    await assert.rejects(service.generateImage(assetId, 256), PreviewSourceChangedError);
    assert.equal(service.repository.latest(assetId, 'thumbnail:256')?.status, 'stale');
    assert.equal(
      database.prepare('SELECT status FROM file_references WHERE asset_id = ?').get(assetId)
        ?.status,
      'changed',
    );
  });
});

test('rejects damaged, unsupported HEIC and excessive-pixel inputs without final cache files', async () => {
  await withLibrary(async ({ directory, database, service }) => {
    const damaged = path.join(directory, 'damaged.png');
    const heic = path.join(directory, 'unsupported.heic');
    const oversized = path.join(directory, 'oversized.svg');
    await fs.writeFile(damaged, 'not-an-image');
    await fs.writeFile(heic, 'invalid-heic-container');
    await fs.writeFile(
      oversized,
      '<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000"><rect width="100%" height="100%"/></svg>',
    );

    for (const source of [damaged, heic, oversized]) {
      const assetId = await registerImage(database, source);
      await assert.rejects(service.generateImage(assetId, 256));
      assert.equal(service.repository.latest(assetId, 'thumbnail:256'), null);
    }
    const thumbnailEntries = await fs.readdir(path.join(directory, 'library', 'thumbnails'));
    assert.equal(thumbnailEntries.length, 3);
    for (const entry of thumbnailEntries) {
      assert.deepEqual(await fs.readdir(path.join(directory, 'library', 'thumbnails', entry)), []);
    }
    assert.deepEqual(await fs.readdir(path.join(directory, 'library', 'task-temp')), []);
  });
});

test('image provider records a single-frame policy for GIF input', async () => {
  await withLibrary(async ({ directory }) => {
    const gif = path.join(directory, 'small.gif');
    const output = path.join(directory, 'small.webp');
    await sharp({ create: { width: 10, height: 10, channels: 4, background: '#ffbe0b' } })
      .gif()
      .toFile(gif);
    const result = await new ImagePreviewProvider().generate({
      sourcePath: gif,
      outputPath: output,
      maxWidth: 256,
      maxHeight: 256,
    });
    assert.equal(result.sourcePages, 1);
    assert.equal((await sharp(output).metadata()).format, 'webp');
  });
});
