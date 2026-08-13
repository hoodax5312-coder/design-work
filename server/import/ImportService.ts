import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { withTransaction } from '../database';
import {
  ImportSessionRepository,
  type CreateImportItem,
  type ImportItemRecord,
} from '../repositories/ImportSessionRepository';
import type { TaskContext } from '../tasks/TaskRunner';
import { DirectoryScanner } from './DirectoryScanner';
import { FileChangedDuringReadError, FingerprintService } from './FingerprintService';

const typeForExtension = (extension: string) => {
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.heic'].includes(extension))
    return 'image';
  if (['.mp4', '.mov', '.webm'].includes(extension)) return 'video';
  if (['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'].includes(extension)) return 'audio';
  if (['.ppt', '.pptx'].includes(extension)) return 'ppt';
  if (['.txt', '.md', '.json'].includes(extension)) return 'knowledge';
  return 'file';
};

const titleForItem = (item: ImportItemRecord) => {
  const override = item.userOverrides.title;
  return typeof override === 'string' && override.trim()
    ? override.trim()
    : path.basename(item.fileName, item.extension);
};

const typeForItem = (item: ImportItemRecord) => {
  const override = item.userOverrides.type;
  return typeof override === 'string' && override.trim() ? override.trim() : item.suggestedType;
};

export class ImportService {
  readonly sessions: ImportSessionRepository;

  constructor(
    private readonly database: DatabaseSync,
    private readonly scanner = new DirectoryScanner(),
    private readonly fingerprints = new FingerprintService(),
  ) {
    this.sessions = new ImportSessionRepository(database);
  }

  async scan(rootPaths: string[], context: TaskContext, options: Record<string, unknown> = {}) {
    if (!rootPaths.length) throw new Error('至少需要选择一个文件或文件夹');
    context.updateProgress(0.02, '扫描文件');
    const scan = await this.scanner.scan(rootPaths, {
      signal: context.signal,
      maxFiles: typeof options.maxFiles === 'number' ? options.maxFiles : undefined,
      onProgress: ({ filesDiscovered }) => {
        context.updateProgress(
          Math.min(0.4, 0.02 + filesDiscovered * 0.0001),
          `已发现 ${filesDiscovered} 个文件`,
        );
      },
    });
    const items: CreateImportItem[] = [];
    const groups = new Map<string, CreateImportItem[]>();

    for (let index = 0; index < scan.files.length; index += 1) {
      const file = scan.files[index];
      const quick = await this.fingerprints.quick(file.absolutePath, { signal: context.signal });
      const id = randomUUID();
      const existingPath = this.database
        .prepare(
          `
        SELECT asset_id, content_hash FROM file_references WHERE absolute_path = ?
      `,
        )
        .get(file.absolutePath);
      const quickCandidates = existingPath
        ? [existingPath]
        : this.database
            .prepare(
              `
        SELECT asset_id, content_hash FROM file_references
        WHERE file_size = ? AND quick_fingerprint = ? AND content_hash IS NOT NULL
        ORDER BY created_at LIMIT 20
      `,
            )
            .all(file.fileSize, quick.key);
      let verifiedHash: string | null = null;
      let duplicateAssetId: string | null = null;
      if (quickCandidates.length) {
        verifiedHash = await this.fingerprints.full(file.absolutePath, { signal: context.signal });
        const exact = quickCandidates.find(
          (candidate) => String(candidate.content_hash || '') === verifiedHash,
        );
        if (exact) duplicateAssetId = String(exact.asset_id);
      }
      const item: CreateImportItem = {
        ...file,
        id,
        quickFingerprint: quick.key,
        contentHash: verifiedHash,
        duplicateAssetId,
        suggestedType: typeForExtension(file.extension),
        suggestions: {
          source: 'extension',
          confidence: 0.7,
          sourceFolder: path.dirname(file.absolutePath),
        },
        decision: duplicateAssetId ? null : 'import_new',
      };
      items.push(item);
      const groupKey = `${file.fileSize}:${quick.key}`;
      const group = groups.get(groupKey) || [];
      group.push(item);
      groups.set(groupKey, group);
      context.updateProgress(
        0.4 + ((index + 1) / Math.max(scan.files.length, 1)) * 0.4,
        '计算快速指纹',
      );
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const hashes = new Map<string, CreateImportItem>();
      for (const item of group) {
        const hash =
          item.contentHash ||
          (await this.fingerprints.full(item.absolutePath, { signal: context.signal }));
        item.contentHash = hash;
        const first = hashes.get(hash);
        if (first) {
          item.duplicateItemId = first.id;
          item.decision = null;
        } else {
          hashes.set(hash, item);
        }
      }
    }

    const sessionId = this.sessions.create(context.taskId, rootPaths, items, options);
    const conflicts = items.filter((item) => item.duplicateAssetId || item.duplicateItemId).length;
    const summary = {
      files: items.length,
      conflicts,
      issues: scan.issues,
      directoriesScanned: scan.directoriesScanned,
    };
    this.sessions.setStatus(sessionId, 'waiting_for_user', summary);
    context.updateProgress(0.9, '等待确认分类和重复项');
    context.waitForUser({ sessionId, ...summary });
  }

  async commit(sessionId: string, context: TaskContext) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('导入会话不存在');
    if (session.status !== 'confirmed' && session.status !== 'failed') {
      throw new Error('导入会话尚未确认');
    }
    this.sessions.setStatus(sessionId, 'importing');
    const items = this.sessions.listItems(sessionId);
    const selected = items.filter((item) => item.decision !== 'skip');
    const hashes = new Map<string, string>();

    try {
      for (let index = 0; index < selected.length; index += 1) {
        const item = selected[index];
        const stat = await fs.stat(item.absolutePath);
        if (
          stat.size !== item.fileSize ||
          Math.trunc(stat.mtimeMs) !== Math.trunc(item.fileModifiedAt)
        ) {
          throw new FileChangedDuringReadError(item.absolutePath);
        }
        const hash =
          item.contentHash ||
          (await this.fingerprints.full(item.absolutePath, { signal: context.signal }));
        hashes.set(item.id, hash);
        const existing = this.database
          .prepare(
            `
          SELECT id FROM assets WHERE content_hash = ?
          UNION ALL
          SELECT asset_id AS id FROM file_references WHERE content_hash = ? LIMIT 1
        `,
          )
          .get(hash, hash);
        this.sessions.setItemHash(item.id, hash, existing ? String(existing.id) : null);
        context.updateProgress(((index + 1) / Math.max(selected.length, 1)) * 0.7, '校验完整指纹');
      }

      const refreshed = this.sessions.listItems(sessionId);
      const itemAssets = new Map<string, string>();
      const assetIds: string[] = [];
      let imported = 0;
      let merged = 0;
      let skipped = items.length - selected.length;
      const now = Date.now();
      withTransaction(this.database, () => {
        const insertAsset = this.database.prepare(`
          INSERT INTO assets(
            id, type, title, description, content_hash, primary_folder_id,
            status, raw_metadata, normalized_metadata, user_metadata,
            created_at, imported_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'active', '{}', '{}', ?, ?, ?, ?)
        `);
        const insertFts = this.database.prepare(`
          INSERT INTO asset_fts(asset_id, title, description, extracted_text) VALUES (?, ?, ?, '')
        `);
        const insertReference = this.database.prepare(`
          INSERT INTO file_references(
            id, asset_id, absolute_path, volume_id, file_name, extension, mime_type,
            file_size, file_created_at, file_modified_at, content_hash, quick_fingerprint,
            last_accessible_at, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?)
        `);
        const linkToProject = this.database.prepare(`
          INSERT OR IGNORE INTO asset_relations(
            id, source_asset_id, target_asset_id, relation_type, sort_order, context_json, created_at
          ) VALUES (?, ?, ?, 'member_of_project', 0, ?, ?)
        `);

        for (const item of refreshed) {
          if (item.decision === 'skip') continue;
          const hash = hashes.get(item.id) as string;
          const duplicateAsset =
            item.duplicateAssetId ||
            (item.duplicateItemId ? itemAssets.get(item.duplicateItemId) || null : null);
          let assetId: string;
          if (item.decision === 'merge_path') {
            if (!duplicateAsset) throw new Error(`重复项缺少可合并的目标：${item.fileName}`);
            assetId = duplicateAsset;
            merged += 1;
          } else {
            if (duplicateAsset && item.decision !== 'keep_separate') {
              throw new Error(`重复项需要选择合并、独立保留或跳过：${item.fileName}`);
            }
            assetId = randomUUID();
            const folderId =
              typeof item.userOverrides.folderId === 'string' ? item.userOverrides.folderId : null;
            const description =
              typeof item.userOverrides.description === 'string'
                ? item.userOverrides.description
                : '';
            const title = titleForItem(item);
            insertAsset.run(
              assetId,
              typeForItem(item),
              title,
              description,
              item.decision === 'keep_separate' ? null : hash,
              folderId,
              JSON.stringify(item.userOverrides),
              now,
              now,
              now,
            );
            insertFts.run(assetId, title, description);
            imported += 1;
          }
          insertReference.run(
            randomUUID(),
            assetId,
            item.absolutePath,
            item.volumeId,
            item.fileName,
            item.extension,
            item.proposedMimeType,
            item.fileSize,
            Math.trunc(item.fileCreatedAt),
            Math.trunc(item.fileModifiedAt),
            hash,
            item.quickFingerprint,
            now,
            now,
            now,
          );
          if (typeof session.options.projectAssetId === 'string') {
            linkToProject.run(
              randomUUID(),
              assetId,
              session.options.projectAssetId,
              JSON.stringify({ importSessionId: sessionId }),
              now,
            );
          }
          itemAssets.set(item.id, assetId);
          assetIds.push(assetId);
        }
        const summary = { imported, merged, skipped, total: items.length };
        this.database
          .prepare(
            `
          UPDATE import_sessions SET status = 'completed', summary_json = ?,
            updated_at = ?, completed_at = ? WHERE id = ?
        `,
          )
          .run(JSON.stringify(summary), now, now, sessionId);
      });
      return { sessionId, assetIds, imported, merged, skipped, total: items.length };
    } catch (error) {
      this.sessions.setStatus(sessionId, context.signal.aborted ? 'cancelled' : 'failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
