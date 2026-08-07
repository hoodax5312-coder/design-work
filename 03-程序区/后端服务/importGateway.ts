import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { FilePickerCancelledError, type FilePickerProvider } from './import/FilePickerProvider';
import { MacOsFilePickerProvider } from './import/MacOsFilePickerProvider';
import type { LibraryRuntime } from './libraryRuntime';
import type { ImportDecision } from './repositories/ImportSessionRepository';

const decisions = new Set<ImportDecision>(['import_new', 'merge_path', 'keep_separate', 'skip']);
const supportedDroppedImageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.heic']);
const maxDroppedImageBytes = 100 * 1024 * 1024;

const dedupeKeyForPaths = (paths: string[]) =>
  createHash('sha256')
    .update(JSON.stringify([...new Set(paths)].sort()))
    .digest('hex');

export const createImportRouter = (
  getRuntime: () => Promise<LibraryRuntime>,
  picker: FilePickerProvider = new MacOsFilePickerProvider(),
) => {
  const router = Router();

  router.post('/pick-files', async (_request, response, next) => {
    try {
      response.json({ paths: await picker.pickFiles(), cancelled: false });
    } catch (error) {
      if (error instanceof FilePickerCancelledError) {
        response.json({ paths: [], cancelled: true });
        return;
      }
      next(error);
    }
  });

  router.post('/pick-directory', async (_request, response, next) => {
    try {
      const selected = await picker.pickDirectory();
      response.json({ paths: selected ? [selected] : [], cancelled: !selected });
    } catch (error) {
      if (error instanceof FilePickerCancelledError) {
        response.json({ paths: [], cancelled: true });
        return;
      }
      next(error);
    }
  });

  router.post('/drop-file', async (request, response, next) => {
    const encodedFileName = request.header('x-design-work-file-name');
    const decodedFileName = encodedFileName ? decodeURIComponent(encodedFileName) : '';
    const fileName = path.basename(decodedFileName);
    const extension = path.extname(fileName).toLowerCase();

    if (!fileName || !supportedDroppedImageExtensions.has(extension)) {
      response.status(400).json({ error: '仅支持拖入 PNG、JPG、WebP、GIF、AVIF 或 HEIC 图片' });
      return;
    }

    let temporaryPath = '';
    try {
      const runtime = await getRuntime();
      const uploadDirectory = path.join(runtime.paths.managedAssets, 'dropped-images');
      await mkdir(uploadDirectory, { recursive: true });
      const storedName = `${randomUUID()}${extension}`;
      const targetPath = path.join(uploadDirectory, storedName);
      temporaryPath = `${targetPath}.part`;
      let receivedBytes = 0;
      const limit = new Transform({
        transform(chunk, _encoding, callback) {
          receivedBytes += chunk.length;
          if (receivedBytes > maxDroppedImageBytes) {
            callback(new Error('单张拖入图片不能超过 100 MB'));
            return;
          }
          callback(null, chunk);
        },
      });
      await pipeline(request, limit, createWriteStream(temporaryPath, { flags: 'wx' }));
      if (receivedBytes === 0) throw new Error('未接收到图片内容');
      await rename(temporaryPath, targetPath);
      temporaryPath = '';
      response.status(201).json({ path: targetPath, originalFileName: fileName });
    } catch (error) {
      if (temporaryPath) await rm(temporaryPath, { force: true }).catch(() => undefined);
      next(error);
    }
  });

  router.post('/scan', async (request, response, next) => {
    try {
      const rootPaths = Array.isArray(request.body?.rootPaths)
        ? request.body.rootPaths.filter(
            (value: unknown): value is string => typeof value === 'string',
          )
        : [];
      if (!rootPaths.length || rootPaths.some((value: string) => !path.isAbsolute(value))) {
        response.status(400).json({ error: '导入路径必须是非空的绝对路径列表' });
        return;
      }
      const runtime = await getRuntime();
      const started = runtime.tasks.start(
        'import.scan',
        {
          rootPaths,
          options:
            request.body?.options && typeof request.body.options === 'object'
              ? request.body.options
              : {},
        },
        dedupeKeyForPaths(rootPaths),
      );
      response
        .status(started.created ? 202 : 200)
        .json({ ...started, task: runtime.tasks.get(started.id) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/sessions/:sessionId', async (request, response, next) => {
    try {
      const runtime = await getRuntime();
      const session = runtime.imports.sessions.get(request.params.sessionId);
      if (!session) {
        response.status(404).json({ error: '导入会话不存在' });
        return;
      }
      response.json({ ...session, items: runtime.imports.sessions.listItems(session.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:sessionId/decisions', async (request, response, next) => {
    try {
      const values = Array.isArray(request.body?.decisions) ? request.body.decisions : [];
      const normalized = values.map((value: unknown) => {
        const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
        if (
          typeof record.itemId !== 'string' ||
          !decisions.has(record.decision as ImportDecision)
        ) {
          throw new Error('导入决策格式无效');
        }
        return {
          itemId: record.itemId,
          decision: record.decision as ImportDecision,
          userOverrides:
            record.userOverrides && typeof record.userOverrides === 'object'
              ? (record.userOverrides as Record<string, unknown>)
              : {},
        };
      });
      const runtime = await getRuntime();
      runtime.imports.sessions.updateDecisions(request.params.sessionId, normalized);
      response.json({
        ...runtime.imports.sessions.get(request.params.sessionId),
        items: runtime.imports.sessions.listItems(request.params.sessionId),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions/:sessionId/confirm', async (request, response, next) => {
    try {
      const runtime = await getRuntime();
      const started = runtime.tasks.start(
        'import.commit',
        { sessionId: request.params.sessionId },
        request.params.sessionId,
      );
      response
        .status(started.created ? 202 : 200)
        .json({ ...started, task: runtime.tasks.get(started.id) });
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
      response.status(400).json({ error: error.message || '导入操作失败' });
    },
  );

  return router;
};
