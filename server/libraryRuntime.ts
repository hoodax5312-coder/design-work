import type { DatabaseSync } from 'node:sqlite';
import { openLibraryDatabase } from './database';
import { createLibraryPaths, ensureLibraryDirectories, type LibraryPaths } from './libraryPaths';
import { TaskRepository } from './repositories/TaskRepository';
import { ImportService } from './import/ImportService';
import { AssetRepository } from './repositories/AssetRepository';
import { FolderRepository } from './repositories/FolderRepository';
import { TagRepository } from './repositories/TagRepository';
import { SmartCollectionRepository } from './repositories/SmartCollectionRepository';
import { PreviewService } from './previews/PreviewService';
import { readStorageSettings } from './storageSettings';
import { TaskRunner } from './tasks/TaskRunner';
import { migrateLegacyGeneratedAssets } from './generatedAssetMigration';

export interface LibraryRuntime {
  database: DatabaseSync;
  paths: LibraryPaths;
  tasks: TaskRunner;
  imports: ImportService;
  assets: AssetRepository;
  folders: FolderRepository;
  tags: TagRepository;
  smartCollections: SmartCollectionRepository;
  previews: PreviewService;
}

export const createLibraryRuntime = async (projectRoot: string): Promise<LibraryRuntime> => {
  const settings = await readStorageSettings(projectRoot);
  const paths = createLibraryPaths(settings.dataDirectory, settings.cacheDirectory);
  await ensureLibraryDirectories(paths);
  const database = openLibraryDatabase(paths.database);
  const tasks = new TaskRunner(new TaskRepository(database));
  const imports = new ImportService(database);
  const assets = new AssetRepository(database);
  const folders = new FolderRepository(database);
  const tags = new TagRepository(database);
  const smartCollections = new SmartCollectionRepository(database);
  const previews = new PreviewService(database, paths);
  tasks.recover();
  tasks.register('import.scan', async (input, context) => {
    const rootPaths = Array.isArray(input.rootPaths)
      ? input.rootPaths.filter((value): value is string => typeof value === 'string')
      : [];
    const options = input.options && typeof input.options === 'object'
      ? input.options as Record<string, unknown>
      : {};
    return imports.scan(rootPaths, context, options);
  });
  tasks.register('import.commit', async (input, context) => {
    if (typeof input.sessionId !== 'string') throw new Error('缺少导入会话 ID');
    return imports.commit(input.sessionId, context);
  });
  tasks.register('preview.image', async (input, context) => {
    if (typeof input.assetId !== 'string') throw new Error('缺少资产 ID');
    const size = Number(input.size || 512);
    context.updateProgress(0.1, '读取图片元数据');
    const result = await previews.generateImage(input.assetId, size === 256 || size === 1024 ? size : 512);
    context.updateProgress(0.95, '写入预览缓存');
    return { assetId: input.assetId, size, reused: result.reused };
  });
  const migration = await migrateLegacyGeneratedAssets({ database, paths, assets, previews });
  if (migration.restored || migration.markedUnrecoverable) {
    console.info(
      `[资产兼容迁移] 扫描 ${migration.scanned} 条，恢复 ${migration.restored} 条，标记不可恢复 ${migration.markedUnrecoverable} 条`,
    );
  }
  return { database, paths, tasks, imports, assets, folders, tags, smartCollections, previews };
};

export const createLibraryRuntimeProvider = (projectRoot: string) => {
  let runtimePromise: Promise<LibraryRuntime> | null = null;
  return () => {
    runtimePromise ||= createLibraryRuntime(projectRoot);
    return runtimePromise;
  };
};
