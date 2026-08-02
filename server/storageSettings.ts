import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteFile } from './atomicFile';

export interface StorageSettings {
  dataDirectory: string;
  cacheDirectory: string;
  autoSaveGeneratedAssets: boolean;
}

export const expandHome = (value: string) => {
  const trimmed = value.trim();
  if (trimmed === '~') return os.homedir();
  if (trimmed.startsWith('~/')) return path.join(os.homedir(), trimmed.slice(2));
  return trimmed;
};

export const defaultStorageSettings = (): StorageSettings => {
  const dataDirectory = path.join(os.homedir(), 'Documents', 'Mboard');
  return {
    dataDirectory,
    cacheDirectory: path.join(dataDirectory, '.cache'),
    autoSaveGeneratedAssets: true,
  };
};

export const normalizeStorageSettings = (
  input: Partial<StorageSettings> = {},
): StorageSettings => {
  const dataDirectory = path.resolve(
    expandHome(input.dataDirectory || defaultStorageSettings().dataDirectory),
  );
  return {
    dataDirectory,
    cacheDirectory: path.resolve(
      expandHome(input.cacheDirectory || path.join(dataDirectory, '.cache')),
    ),
    autoSaveGeneratedAssets:
      typeof input.autoSaveGeneratedAssets === 'boolean'
        ? input.autoSaveGeneratedAssets
        : defaultStorageSettings().autoSaveGeneratedAssets,
  };
};

export const storageSettingsPath = (projectRoot: string) =>
  path.join(projectRoot, '.mboard', 'settings.json');

export const readStorageSettings = async (projectRoot: string): Promise<StorageSettings> => {
  try {
    const raw = await fs.readFile(storageSettingsPath(projectRoot), 'utf8');
    return normalizeStorageSettings(JSON.parse(raw) as Partial<StorageSettings>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return defaultStorageSettings();
  }
};

export const writeStorageSettings = async (
  projectRoot: string,
  input: Partial<StorageSettings>,
): Promise<StorageSettings> => {
  const settings = normalizeStorageSettings(input);
  const configPath = storageSettingsPath(projectRoot);

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.mkdir(settings.dataDirectory, { recursive: true });
  await fs.mkdir(settings.cacheDirectory, { recursive: true });
  await atomicWriteFile(configPath, JSON.stringify(settings, null, 2));
  return settings;
};
