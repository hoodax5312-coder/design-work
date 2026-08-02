import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface PreviewArtifactRecord {
  id: string;
  assetId: string;
  kind: string;
  cachePath: string;
  sourceHash: string | null;
  generatorVersion: string;
  fileSize: number;
  pinned: boolean;
  status: string;
  metadata: Record<string, unknown>;
  lastAccessedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

const mapPreview = (row: Record<string, unknown>): PreviewArtifactRecord => ({
  id: String(row.id),
  assetId: String(row.asset_id),
  kind: String(row.kind),
  cachePath: String(row.cache_path),
  sourceHash: row.source_hash == null ? null : String(row.source_hash),
  generatorVersion: String(row.generator_version),
  fileSize: Number(row.file_size),
  pinned: Boolean(row.pinned),
  status: String(row.status),
  metadata: JSON.parse(String(row.metadata_json || '{}')) as Record<string, unknown>,
  lastAccessedAt: row.last_accessed_at == null ? null : Number(row.last_accessed_at),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

export class PreviewRepository {
  constructor(private readonly database: DatabaseSync) {}

  find(assetId: string, kind: string, generatorVersion: string) {
    const row = this.database
      .prepare(
        `
      SELECT * FROM preview_artifacts
      WHERE asset_id = ? AND kind = ? AND generator_version = ?
    `,
      )
      .get(assetId, kind, generatorVersion);
    return row ? mapPreview(row) : null;
  }

  latest(assetId: string, kind: string) {
    const row = this.database
      .prepare(
        `
      SELECT * FROM preview_artifacts WHERE asset_id = ? AND kind = ?
      ORDER BY CASE status WHEN 'ready' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1
    `,
      )
      .get(assetId, kind);
    return row ? mapPreview(row) : null;
  }

  upsert(
    input: {
      assetId: string;
      kind: string;
      cachePath: string;
      sourceHash: string;
      generatorVersion: string;
      fileSize: number;
      metadata: Record<string, unknown>;
    },
    now = Date.now(),
  ) {
    this.database
      .prepare(
        `
      INSERT INTO preview_artifacts(
        id, asset_id, kind, cache_path, source_hash, generator_version,
        file_size, pinned, status, metadata_json, last_accessed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'ready', ?, ?, ?, ?)
      ON CONFLICT(asset_id, kind, generator_version) DO UPDATE SET
        cache_path = excluded.cache_path,
        source_hash = excluded.source_hash,
        file_size = excluded.file_size,
        status = 'ready',
        metadata_json = excluded.metadata_json,
        last_accessed_at = excluded.last_accessed_at,
        updated_at = excluded.updated_at
    `,
      )
      .run(
        randomUUID(),
        input.assetId,
        input.kind,
        input.cachePath,
        input.sourceHash,
        input.generatorVersion,
        input.fileSize,
        JSON.stringify(input.metadata),
        now,
        now,
        now,
      );
    return this.find(input.assetId, input.kind, input.generatorVersion);
  }

  touch(id: string, now = Date.now()) {
    this.database
      .prepare(
        `
      UPDATE preview_artifacts SET last_accessed_at = ?, updated_at = ? WHERE id = ?
    `,
      )
      .run(now, now, id);
  }

  setPinned(id: string, pinned: boolean, now = Date.now()) {
    this.database
      .prepare(
        `
      UPDATE preview_artifacts SET pinned = ?, updated_at = ? WHERE id = ?
    `,
      )
      .run(pinned ? 1 : 0, now, id);
  }

  markStale(assetId: string, now = Date.now()) {
    this.database
      .prepare(
        `
      UPDATE preview_artifacts SET status = 'stale', updated_at = ?
      WHERE asset_id = ? AND status = 'ready'
    `,
      )
      .run(now, assetId);
  }

  listEvictable(limit = 100) {
    return this.database
      .prepare(
        `
      SELECT * FROM preview_artifacts
      WHERE pinned = 0 AND status IN ('ready', 'stale')
      ORDER BY COALESCE(last_accessed_at, created_at), created_at LIMIT ?
    `,
      )
      .all(Math.min(Math.max(limit, 1), 1000))
      .map(mapPreview);
  }

  remove(id: string) {
    this.database.prepare('DELETE FROM preview_artifacts WHERE id = ?').run(id);
  }
}
