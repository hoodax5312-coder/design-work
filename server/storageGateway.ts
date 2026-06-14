import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Router } from 'express';

const execFileAsync = promisify(execFile);

export interface StorageSettings {
  dataDirectory: string;
  autoSaveGeneratedAssets: boolean;
}

const expandHome = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === '~') return os.homedir();
  if (trimmed.startsWith('~/')) return path.join(os.homedir(), trimmed.slice(2));
  return trimmed;
};

const defaultSettings = (): StorageSettings => ({
  dataDirectory: path.join(os.homedir(), 'Documents', 'Mboard'),
  autoSaveGeneratedAssets: true,
});

const normalizeSettings = (input: Partial<StorageSettings> = {}): StorageSettings => ({
  dataDirectory: expandHome(input.dataDirectory || defaultSettings().dataDirectory),
  autoSaveGeneratedAssets:
    typeof input.autoSaveGeneratedAssets === 'boolean'
      ? input.autoSaveGeneratedAssets
      : defaultSettings().autoSaveGeneratedAssets,
});

export const createStorageRouter = (projectRoot: string) => {
  const router = Router();
  const configDir = path.join(projectRoot, '.mboard');
  const configPath = path.join(configDir, 'settings.json');

  const readSettings = async () => {
    try {
      const raw = await fs.readFile(configPath, 'utf8');
      return normalizeSettings(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return defaultSettings();
    }
  };

  const writeSettings = async (settings: StorageSettings) => {
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(settings.dataDirectory, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf8');
  };

  router.get('/settings', async (_request, response, next) => {
    try {
      response.json(await readSettings());
    } catch (error) {
      next(error);
    }
  });

  router.post('/settings', async (request, response, next) => {
    try {
      const settings = normalizeSettings(request.body);
      await writeSettings(settings);
      response.json(settings);
    } catch (error) {
      next(error);
    }
  });

  router.post('/choose-directory', async (_request, response, next) => {
    try {
      const { stdout } = await execFileAsync('osascript', [
        '-e',
        'POSIX path of (choose folder with prompt "选择 Mboard 数据保存文件夹")',
      ]);
      const dataDirectory = stdout.trim();
      const current = await readSettings();
      const settings = normalizeSettings({ ...current, dataDirectory });
      await writeSettings(settings);
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
