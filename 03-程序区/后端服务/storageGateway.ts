import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Router } from 'express';
import {
  readStorageSettings,
  writeStorageSettings,
  type StorageSettings,
} from './storageSettings';

const execFileAsync = promisify(execFile);

const chooseDirectory = async (prompt: string) => {
  const { stdout } = await execFileAsync('osascript', [
    '-e',
    `POSIX path of (choose folder with prompt "${prompt}")`,
  ]);
  return stdout.trim();
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
      const dataDirectory = await chooseDirectory('选择 Mboard 数据保存文件夹');
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
      const cacheDirectory = await chooseDirectory('选择 Mboard 缓存文件夹');
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
