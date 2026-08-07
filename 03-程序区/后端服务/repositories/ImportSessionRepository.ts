import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { withTransaction } from '../database';
import type { DiscoveredFile } from '../import/DirectoryScanner';

export type ImportSessionStatus =
  | 'scanning'
  | 'waiting_for_user'
  | 'confirmed'
  | 'importing'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type ImportDecision = 'import_new' | 'merge_path' | 'keep_separate' | 'skip';

export interface ImportItemRecord extends DiscoveredFile {
  id: string;
  sessionId: string;
  sortOrder: number;
  quickFingerprint: string | null;
  contentHash: string | null;
  duplicateAssetId: string | null;
  duplicateItemId: string | null;
  suggestedType: string;
  suggestions: Record<string, unknown>;
  decision: ImportDecision | null;
  userOverrides: Record<string, unknown>;
}

export interface ImportSessionRecord {
  id: string;
  taskId: string | null;
  status: ImportSessionStatus;
  rootPaths: string[];
  options: Record<string, unknown>;
  summary: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  confirmedAt: number | null;
  completedAt: number | null;
}

export interface CreateImportItem extends DiscoveredFile {
  id?: string;
  quickFingerprint: string;
  contentHash?: string | null;
  duplicateAssetId?: string | null;
  duplicateItemId?: string | null;
  suggestedType: string;
  suggestions?: Record<string, unknown>;
  decision?: ImportDecision | null;
}

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value == null || value === '') return fallback;
  return JSON.parse(String(value)) as T;
};

const mapSession = (row: Record<string, unknown>): ImportSessionRecord => ({
  id: String(row.id),
  taskId: row.task_id == null ? null : String(row.task_id),
  status: String(row.status) as ImportSessionStatus,
  rootPaths: parseJson(row.root_paths_json, []),
  options: parseJson(row.options_json, {}),
  summary: parseJson(row.summary_json, {}),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  confirmedAt: row.confirmed_at == null ? null : Number(row.confirmed_at),
  completedAt: row.completed_at == null ? null : Number(row.completed_at),
});

const mapItem = (row: Record<string, unknown>): ImportItemRecord => ({
  id: String(row.id),
  sessionId: String(row.session_id),
  sortOrder: Number(row.sort_order),
  absolutePath: String(row.absolute_path),
  fileName: String(row.file_name),
  extension: String(row.extension),
  proposedMimeType: row.proposed_mime_type == null ? null : String(row.proposed_mime_type),
  fileSize: Number(row.file_size),
  fileCreatedAt: Number(row.file_created_at),
  fileModifiedAt: Number(row.file_modified_at),
  volumeId: String(row.volume_id),
  volumeLabel: String(row.volume_label),
  quickFingerprint: row.quick_fingerprint == null ? null : String(row.quick_fingerprint),
  contentHash: row.content_hash == null ? null : String(row.content_hash),
  duplicateAssetId: row.duplicate_asset_id == null ? null : String(row.duplicate_asset_id),
  duplicateItemId: row.duplicate_item_id == null ? null : String(row.duplicate_item_id),
  suggestedType: String(row.suggested_type),
  suggestions: parseJson(row.suggestions_json, {}),
  decision: row.decision == null ? null : (String(row.decision) as ImportDecision),
  userOverrides: parseJson(row.user_overrides_json, {}),
});

export class ImportSessionRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(
    taskId: string | null,
    rootPaths: string[],
    items: CreateImportItem[],
    options: Record<string, unknown> = {},
    now = Date.now(),
  ) {
    const id = randomUUID();
    const insertItem = this.database.prepare(`
      INSERT INTO import_items(
        id, session_id, sort_order, absolute_path, file_name, extension, proposed_mime_type,
        file_size, file_created_at, file_modified_at, volume_id, volume_label,
        quick_fingerprint, content_hash, duplicate_asset_id, duplicate_item_id,
        suggested_type, suggestions_json, decision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    withTransaction(this.database, () => {
      this.database
        .prepare(
          `
        INSERT INTO import_sessions(
          id, task_id, status, root_paths_json, options_json, summary_json, created_at, updated_at
        ) VALUES (?, ?, 'scanning', ?, ?, '{}', ?, ?)
      `,
        )
        .run(id, taskId, JSON.stringify(rootPaths), JSON.stringify(options), now, now);
      for (const [sortOrder, item] of items.entries()) {
        insertItem.run(
          item.id || randomUUID(),
          id,
          sortOrder,
          item.absolutePath,
          item.fileName,
          item.extension,
          item.proposedMimeType,
          item.fileSize,
          Math.trunc(item.fileCreatedAt),
          Math.trunc(item.fileModifiedAt),
          item.volumeId,
          item.volumeLabel,
          item.quickFingerprint,
          item.contentHash ?? null,
          item.duplicateAssetId ?? null,
          item.duplicateItemId ?? null,
          item.suggestedType,
          JSON.stringify(item.suggestions || {}),
          item.decision ?? null,
          now,
          now,
        );
      }
    });
    return id;
  }

  get(id: string) {
    const row = this.database.prepare('SELECT * FROM import_sessions WHERE id = ?').get(id);
    return row ? mapSession(row) : null;
  }

  listItems(sessionId: string) {
    return this.database
      .prepare(
        `
      SELECT * FROM import_items WHERE session_id = ? ORDER BY sort_order, id
    `,
      )
      .all(sessionId)
      .map(mapItem);
  }

  getItem(id: string) {
    const row = this.database.prepare('SELECT * FROM import_items WHERE id = ?').get(id);
    return row ? mapItem(row) : null;
  }

  setStatus(
    id: string,
    status: ImportSessionStatus,
    summary?: Record<string, unknown>,
    now = Date.now(),
  ) {
    this.database
      .prepare(
        `
      UPDATE import_sessions SET status = ?, summary_json = COALESCE(?, summary_json),
        updated_at = ?, confirmed_at = CASE WHEN ? = 'confirmed' THEN ? ELSE confirmed_at END,
        completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END
      WHERE id = ?
    `,
      )
      .run(status, summary ? JSON.stringify(summary) : null, now, status, now, status, now, id);
  }

  setItemHash(id: string, contentHash: string, duplicateAssetId: string | null, now = Date.now()) {
    this.database
      .prepare(
        `
      UPDATE import_items SET content_hash = ?, duplicate_asset_id = ?, updated_at = ? WHERE id = ?
    `,
      )
      .run(contentHash, duplicateAssetId, now, id);
  }

  updateDecisions(
    sessionId: string,
    decisions: Array<{
      itemId: string;
      decision: ImportDecision;
      userOverrides?: Record<string, unknown>;
    }>,
    now = Date.now(),
  ) {
    const update = this.database.prepare(`
      UPDATE import_items SET decision = ?, user_overrides_json = ?, updated_at = ?
      WHERE id = ? AND session_id = ?
    `);
    withTransaction(this.database, () => {
      for (const decision of decisions) {
        const result = update.run(
          decision.decision,
          JSON.stringify(decision.userOverrides || {}),
          now,
          decision.itemId,
          sessionId,
        );
        if (result.changes !== 1) throw new Error(`导入项不存在：${decision.itemId}`);
      }
      this.setStatus(sessionId, 'confirmed', undefined, now);
    });
  }
}
