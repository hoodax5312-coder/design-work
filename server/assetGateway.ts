import { Router } from 'express';
import type { LibraryRuntime } from './libraryRuntime';
import type { SmartCollectionRules } from './repositories/SmartCollectionRepository';
import { MacOsFilePickerProvider } from './import/MacOsFilePickerProvider';
import { FilePickerCancelledError, type FilePickerProvider } from './import/FilePickerProvider';
import { FingerprintService } from './import/FingerprintService';
import { randomUUID } from 'node:crypto';
import { removeStoredGeneratedImage, storeGeneratedImage } from './generatedAssetStorage';
import fs from 'node:fs/promises';
import path from 'node:path';

const asBoolean = (value: unknown) => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
};

const asOptionalNumber = (value: unknown) => {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const stringArray = (value: unknown) => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string' && value.trim())
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  return [];
};

const mapFileReference = (row: Record<string, unknown>) => ({
  id: String(row.id),
  absolutePath: String(row.absolute_path),
  volumeId: row.volume_id == null ? null : String(row.volume_id),
  fileName: String(row.file_name),
  extension: String(row.extension),
  mimeType: row.mime_type == null ? null : String(row.mime_type),
  fileSize: Number(row.file_size),
  fileCreatedAt: row.file_created_at == null ? null : Number(row.file_created_at),
  fileModifiedAt: row.file_modified_at == null ? null : Number(row.file_modified_at),
  status: String(row.status),
  lastAccessibleAt: row.last_accessible_at == null ? null : Number(row.last_accessible_at),
});

const mapAssetWithPreview = (runtime: LibraryRuntime, asset: ReturnType<LibraryRuntime['assets']['get']>) => {
  if (!asset) return asset;
  const latestPreviewStatus = runtime.previews.repository.latest(asset.id, 'thumbnail:512')?.status;
  const generatedSourceStatus = asset.userMetadata?.generatedSourceStatus;
  return {
    ...asset,
    previewUrl: `/api/assets/${asset.id}/preview?size=512&v=${asset.updatedAt}`,
    previewStatus: latestPreviewStatus ||
      (generatedSourceStatus === 'unrecoverable' ? 'unrecoverable' : 'missing'),
  };
};

export const createAssetRouter = (
  getRuntime: () => Promise<LibraryRuntime>,
  picker: FilePickerProvider = new MacOsFilePickerProvider(),
  fingerprints: FingerprintService = new FingerprintService(),
) => {
  const router = Router();

  router.get('/', async (request, response, next) => {
    try {
      const runtime = await getRuntime();
      const page = runtime.assets.searchPage({
        query: request.query.query ? String(request.query.query) : undefined,
        types: stringArray(request.query.type),
        folderId: request.query.folderId ? String(request.query.folderId) : undefined,
        unfiled: asBoolean(request.query.unfiled),
        tagIds: stringArray(request.query.tagId),
        favorite: asBoolean(request.query.favorite),
        ratingMin: asOptionalNumber(request.query.ratingMin),
        status: request.query.status ? String(request.query.status) : undefined,
        createdFrom: asOptionalNumber(request.query.createdFrom),
        createdTo: asOptionalNumber(request.query.createdTo),
        limit: asOptionalNumber(request.query.limit),
        offset: asOptionalNumber(request.query.offset),
        sort: ['updatedAt', 'createdAt', 'title', 'rating'].includes(String(request.query.sort))
          ? (String(request.query.sort) as 'updatedAt' | 'createdAt' | 'title' | 'rating')
          : undefined,
      });
      response.json({
        ...page,
        items: page.items.map((asset) => mapAssetWithPreview(runtime, asset)),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (request, response, next) => {
    try {
      const type = typeof request.body?.type === 'string' ? request.body.type.trim() : '';
      const title = typeof request.body?.title === 'string' ? request.body.title.trim() : '';
      if (!type || !title) throw new Error('资产类型和标题不能为空');
      const runtime = await getRuntime();
      const userMetadata =
        request.body.userMetadata && typeof request.body.userMetadata === 'object'
          ? request.body.userMetadata as Record<string, unknown>
          : {};
      const generatedSource =
        type === 'image' && typeof request.body.sourceUrl === 'string'
          ? request.body.sourceUrl
          : type === 'image' && typeof userMetadata.generatedUrl === 'string'
            ? userMetadata.generatedUrl
            : '';
      const assetId = randomUUID();
      const stored = generatedSource
        ? await storeGeneratedImage(runtime.paths, generatedSource, assetId)
        : null;
      try {
        const asset = runtime.assets.create({
          id: assetId,
          type,
          title,
          description: typeof request.body.description === 'string' ? request.body.description : '',
          contentHash: stored?.reference.contentHash,
          sourceUrl: stored?.sourceUrl,
          primaryFolderId:
            typeof request.body.primaryFolderId === 'string' ? request.body.primaryFolderId : null,
          userMetadata,
          fileReference: stored?.reference,
        });
        if (stored && runtime.tasks.supportedTypes().includes('preview.image')) {
          runtime.tasks.start('preview.image', { assetId, size: 512 }, `${assetId}:512`);
        }
        response.status(201).json(mapAssetWithPreview(runtime, asset));
      } catch (error) {
        if (stored) await removeStoredGeneratedImage(stored);
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });

  router.get('/folders', async (_request, response, next) => {
    try {
      response.json({ items: (await getRuntime()).folders.listWithCounts() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/folders', async (request, response, next) => {
    try {
      const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
      if (!name) throw new Error('文件夹名称不能为空');
      response
        .status(201)
        .json(
          (await getRuntime()).folders.create(
            name,
            typeof request.body.parentId === 'string' ? request.body.parentId : null,
          ),
        );
    } catch (error) {
      next(error);
    }
  });

  router.patch('/folders/:folderId', async (request, response, next) => {
    try {
      response.json(
        (await getRuntime()).folders.rename(
          request.params.folderId,
          String(request.body?.name || ''),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.delete('/folders/:folderId', async (request, response, next) => {
    try {
      (await getRuntime()).folders.remove(request.params.folderId);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get('/tags', async (_request, response, next) => {
    try {
      response.json({ items: (await getRuntime()).tags.listWithCounts() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/tags', async (request, response, next) => {
    try {
      const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
      if (!name) throw new Error('标签名称不能为空');
      const runtime = await getRuntime();
      const id = runtime.tags.create(
        name,
        typeof request.body.color === 'string' ? request.body.color : null,
        typeof request.body.groupName === 'string' ? request.body.groupName : null,
      );
      response.status(201).json(runtime.tags.listWithCounts().find((tag) => String(tag.id) === id));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/tags/:tagId', async (request, response, next) => {
    try {
      const runtime = await getRuntime();
      runtime.tags.rename(request.params.tagId, String(request.body?.name || ''));
      response.json(
        runtime.tags.listWithCounts().find((tag) => String(tag.id) === request.params.tagId),
      );
    } catch (error) {
      next(error);
    }
  });

  router.delete('/tags/:tagId', async (request, response, next) => {
    try {
      (await getRuntime()).tags.remove(request.params.tagId);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.get('/smart-collections', async (_request, response, next) => {
    try {
      response.json({ items: (await getRuntime()).smartCollections.list() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/smart-collections', async (request, response, next) => {
    try {
      response
        .status(201)
        .json(
          (await getRuntime()).smartCollections.create(
            String(request.body?.name || ''),
            request.body?.rules as SmartCollectionRules,
          ),
        );
    } catch (error) {
      next(error);
    }
  });

  router.get('/smart-collections/:collectionId/assets', async (request, response, next) => {
    try {
      const runtime = await getRuntime();
      const ids = runtime.smartCollections.evaluate(
        request.params.collectionId,
        Number(request.query.limit || 100),
        Number(request.query.offset || 0),
      );
      response.json({ items: ids.map((id) => runtime.assets.get(id)).filter(Boolean) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/issues', async (_request, response, next) => {
    try {
      const runtime = await getRuntime();
      const items = runtime.database
        .prepare(
          `
        SELECT fr.*, a.title AS asset_title, a.type AS asset_type
        FROM file_references fr JOIN assets a ON a.id = fr.asset_id
        WHERE fr.status <> 'online' ORDER BY fr.updated_at DESC LIMIT 500
      `,
        )
        .all()
        .map((row) => ({
          ...mapFileReference(row),
          assetId: String(row.asset_id),
          assetTitle: String(row.asset_title),
          assetType: String(row.asset_type),
        }));
      response.json({
        items,
        totalReferences: Number(
          runtime.database.prepare('SELECT COUNT(*) AS count FROM file_references').get()?.count ||
            0,
        ),
        counts: items.reduce<Record<string, number>>((counts, item) => {
          counts[item.status] = (counts[item.status] || 0) + 1;
          return counts;
        }, {}),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/bulk/tags', async (request, response, next) => {
    try {
      const assetIds = stringArray(request.body?.assetIds).slice(0, 500);
      const tagIds = stringArray(request.body?.tagIds).slice(0, 100);
      const runtime = await getRuntime();
      if (request.body?.action === 'remove') runtime.tags.bulkDetach(assetIds, tagIds);
      else runtime.tags.bulkAttach(assetIds, tagIds);
      response.json({ ok: true, assets: assetIds.length, tags: tagIds.length });
    } catch (error) {
      next(error);
    }
  });

  router.post('/bulk/move', async (request, response, next) => {
    try {
      const assetIds = stringArray(request.body?.assetIds).slice(0, 500);
      (await getRuntime()).assets.bulkMove(
        assetIds,
        typeof request.body?.folderId === 'string' ? request.body.folderId : null,
      );
      response.json({ ok: true, assets: assetIds.length });
    } catch (error) {
      next(error);
    }
  });

  router.post('/bulk/favorite', async (request, response, next) => {
    try {
      const assetIds = stringArray(request.body?.assetIds).slice(0, 500);
      (await getRuntime()).assets.bulkFavorite(assetIds, Boolean(request.body?.favorite));
      response.json({ ok: true, assets: assetIds.length });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:assetId/preview', async (request, response, next) => {
    try {
      const size = Number(request.query.size || 512);
      const runtime = await getRuntime();
      const previewPath = await runtime.previews.getReadyPath(
        request.params.assetId,
        size === 256 || size === 1024 ? size : 512,
      );
      if (!previewPath) {
        response.status(404).json({ error: '预览尚未生成' });
        return;
      }
      response.setHeader('Cache-Control', 'private, max-age=3600');
      response.sendFile(previewPath);
    } catch (error) {
      next(error);
    }
  });

  router.post('/:assetId/preview', async (request, response, next) => {
    try {
      const size = Number(request.body?.size || 512);
      const normalizedSize = size === 256 || size === 1024 ? size : 512;
      const runtime = await getRuntime();
      const started = runtime.tasks.start(
        'preview.image',
        { assetId: request.params.assetId, size: normalizedSize },
        `${request.params.assetId}:${normalizedSize}`,
      );
      response
        .status(started.created ? 202 : 200)
        .json({ ...started, task: runtime.tasks.get(started.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:assetId/files/:fileId/relocate', async (request, response, next) => {
    try {
      const runtime = await getRuntime();
      const reference = runtime.database
        .prepare(
          `
        SELECT * FROM file_references WHERE id = ? AND asset_id = ?
      `,
        )
        .get(request.params.fileId, request.params.assetId);
      if (!reference) throw new Error('原文件引用不存在');
      let selected: string[];
      try {
        selected = await picker.pickFiles();
      } catch (error) {
        if (error instanceof FilePickerCancelledError) {
          response.json({ cancelled: true });
          return;
        }
        throw error;
      }
      const absolutePath = selected[0];
      if (!absolutePath) {
        response.json({ cancelled: true });
        return;
      }
      const stat = await fs.stat(absolutePath);
      if (!stat.isFile()) throw new Error('新位置不是普通文件');
      if (reference.content_hash) {
        const hash = await fingerprints.full(absolutePath);
        if (hash !== String(reference.content_hash))
          throw new Error('选择的文件与原资产指纹不匹配');
      }
      runtime.database
        .prepare(
          `
        UPDATE file_references SET absolute_path = ?, file_name = ?, extension = ?,
          file_size = ?, file_created_at = ?, file_modified_at = ?, status = 'online',
          last_accessible_at = ?, updated_at = ? WHERE id = ?
      `,
        )
        .run(
          absolutePath,
          path.basename(absolutePath),
          path.extname(absolutePath).toLowerCase(),
          stat.size,
          Math.trunc(stat.birthtimeMs),
          Math.trunc(stat.mtimeMs),
          Date.now(),
          Date.now(),
          request.params.fileId,
        );
      response.json({
        cancelled: false,
        file: mapFileReference(
          runtime.database
            .prepare('SELECT * FROM file_references WHERE id = ?')
            .get(request.params.fileId) as Record<string, unknown>,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:assetId', async (request, response, next) => {
    try {
      const runtime = await getRuntime();
      const asset = runtime.assets.get(request.params.assetId);
      if (!asset) {
        response.status(404).json({ error: '资产不存在' });
        return;
      }
      response.json({
        ...mapAssetWithPreview(runtime, asset),
        tags: runtime.tags.listForAsset(asset.id),
        files: runtime.database
          .prepare(
            `
          SELECT * FROM file_references WHERE asset_id = ? ORDER BY created_at
        `,
          )
          .all(asset.id)
          .map(mapFileReference),
        previews: runtime.database
          .prepare(
            `
          SELECT id, kind, status, file_size, pinned, updated_at
          FROM preview_artifacts WHERE asset_id = ? ORDER BY kind, updated_at DESC
        `,
          )
          .all(asset.id),
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:assetId', async (request, response, next) => {
    try {
      response.json((await getRuntime()).assets.update(request.params.assetId, request.body || {}));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:assetId', async (request, response, next) => {
    try {
      (await getRuntime()).assets.softDelete(request.params.assetId);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.post('/:assetId/restore', async (request, response, next) => {
    try {
      const runtime = await getRuntime();
      runtime.assets.restore(request.params.assetId);
      response.json(runtime.assets.get(request.params.assetId));
    } catch (error) {
      next(error);
    }
  });

  router.use(
    (
      error: Error,
      _request: unknown,
      response: { status: (code: number) => { json: (body: unknown) => void } },
      _next: unknown,
    ) => {
      response.status(400).json({ error: error.message || '资产操作失败' });
    },
  );

  return router;
};
