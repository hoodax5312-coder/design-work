import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Router } from 'express';
import { atomicWriteFile } from './atomicFile';
import {
  readStorageSettings,
  writeStorageSettings,
  type StorageSettings,
} from './storageSettings';
import { createLibraryPaths } from './libraryPaths';

const execFileAsync = promisify(execFile);
const WORKSPACE_CACHE_KEYS = new Set(['generation-history', 'canvas-workspace']);
const MODULE_IDS = new Set(['generation', 'canvas', 'assets', 'knowledge', 'tools', 'settings']);

const workspaceCachePath = async (projectRoot: string, key: string) => {
  if (!WORKSPACE_CACHE_KEYS.has(key)) throw new Error('不支持的创作缓存类型');
  const settings = await readStorageSettings(projectRoot);
  return path.join(settings.cacheDirectory, 'workspace', `${key}.json`);
};

const chooseDirectory = async (prompt: string) => {
  const { stdout } = await execFileAsync('osascript', [
    '-e',
    `POSIX path of (choose folder with prompt "${prompt}")`,
  ]);
  return stdout.trim();
};

const modulePath = (paths: ReturnType<typeof createLibraryPaths>, moduleId: string) => {
  if (!MODULE_IDS.has(moduleId)) throw new Error('不支持的存储模块');
  return paths.modules[moduleId as keyof typeof paths.modules];
};

const revealPath = async (targetPath: string) => {
  try {
    const stats = await fs.stat(targetPath);
    await execFileAsync('open', stats.isDirectory() ? [targetPath] : ['-R', targetPath]);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  let existingPath = path.dirname(targetPath);
  while (existingPath !== path.dirname(existingPath)) {
    try {
      await fs.access(existingPath);
      await execFileAsync('open', [existingPath]);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      existingPath = path.dirname(existingPath);
    }
  }
  throw new Error('存储位置尚未创建');
};

export const createStorageRouter = (projectRoot: string) => {
  const router = Router();

  router.get('/settings', async (_request, response, next) => {
    try {
      response.json(await readStorageSettings(projectRoot));
    } catch (error) {
      next(error);
    }
  });

  router.get('/modules', async (_request, response, next) => {
    try {
      const settings = await readStorageSettings(projectRoot);
      const paths = createLibraryPaths(settings.dataDirectory, settings.cacheDirectory);
      response.json({
        modules: [
          { id: 'generation', name: '生图', description: '生成历史与任务结果', path: paths.modules.generation, storage: '缓存' },
          { id: 'canvas', name: '画布', description: '画布项目与工作区状态', path: paths.modules.canvas, storage: '缓存' },
          { id: 'assets', name: '资产', description: '资产数据库与托管文件', path: paths.modules.assets, storage: '数据' },
          { id: 'knowledge', name: '知识', description: '笔记、词库与知识文件索引', path: paths.modules.knowledge, storage: '数据' },
          { id: 'tools', name: '工具', description: '工具运行产生的临时文件', path: paths.modules.tools, storage: '缓存' },
          { id: 'settings', name: '设置', description: '工作区配置与数据库', path: paths.modules.settings, storage: '数据' },
        ],
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/modules/:moduleId/reveal', async (request, response, next) => {
    try {
      const settings = await readStorageSettings(projectRoot);
      const paths = createLibraryPaths(settings.dataDirectory, settings.cacheDirectory);
      await revealPath(modulePath(paths, request.params.moduleId));
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/settings', async (request, response, next) => {
    try {
      const settings = await writeStorageSettings(projectRoot, request.body as Partial<StorageSettings>);
      response.json(settings);
    } catch (error) {
      next(error);
    }
  });

  router.post('/choose-directory', async (_request, response, next) => {
    try {
      const dataDirectory = await chooseDirectory('选择栗作数据保存文件夹');
      const current = await readStorageSettings(projectRoot);
      const settings = await writeStorageSettings(projectRoot, { ...current, dataDirectory });
      response.json(settings);
    } catch (error) {
      if ((error as Error).message.includes('User canceled')) {
        response.status(400).json({ error: '已取消选择文件夹' });
        return;
      }
      next(error);
    }
  });

  router.post('/choose-cache-directory', async (_request, response, next) => {
    try {
      const cacheDirectory = await chooseDirectory('选择栗作缓存文件夹');
      const current = await readStorageSettings(projectRoot);
      const settings = await writeStorageSettings(projectRoot, { ...current, cacheDirectory });
      response.json(settings);
    } catch (error) {
      if ((error as Error).message.includes('User canceled')) {
        response.status(400).json({ error: '已取消选择文件夹' });
        return;
      }
      next(error);
    }
  });

  router.get('/workspace/:key', async (request, response, next) => {
    try {
      const filePath = await workspaceCachePath(projectRoot, request.params.key);
      try {
        response.json(JSON.parse(await fs.readFile(filePath, 'utf8')));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        response.json(null);
      }
    } catch (error) {
      next(error);
    }
  });

  router.put('/workspace/:key', async (request, response, next) => {
    try {
      const filePath = await workspaceCachePath(projectRoot, request.params.key);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await atomicWriteFile(filePath, JSON.stringify(request.body ?? null));
      response.json({ ok: true });
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
      response.status(500).json({
        error: error.message || '存储设置操作失败',
      });
    },
  );

  return router;
};
