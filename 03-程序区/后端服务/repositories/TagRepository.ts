import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { withTransaction } from '../database';

export class TagRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(
    name: string,
    color: string | null = null,
    groupName: string | null = null,
    now = Date.now(),
  ) {
    const id = randomUUID();
    this.database
      .prepare(
        `
      INSERT INTO tags(id, name, color, group_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(id, name.trim(), color, groupName, now, now);
    return id;
  }

  attach(assetId: string, tagId: string, now = Date.now()) {
    this.database
      .prepare(
        `
      INSERT OR IGNORE INTO asset_tags(asset_id, tag_id, created_at) VALUES (?, ?, ?)
    `,
      )
      .run(assetId, tagId, now);
  }

  merge(sourceTagId: string, targetTagId: string) {
    if (sourceTagId === targetTagId) return;
    withTransaction(this.database, () => {
      this.database
        .prepare(
          `
        INSERT OR IGNORE INTO asset_tags(asset_id, tag_id, created_at)
        SELECT asset_id, ?, created_at FROM asset_tags WHERE tag_id = ?
      `,
        )
        .run(targetTagId, sourceTagId);
      this.database.prepare('DELETE FROM tags WHERE id = ?').run(sourceTagId);
    });
  }

  listForAsset(assetId: string) {
    return this.database
      .prepare(
        `
      SELECT t.* FROM tags t
      JOIN asset_tags at ON at.tag_id = t.id
      WHERE at.asset_id = ?
      ORDER BY t.name COLLATE NOCASE
    `,
      )
      .all(assetId);
  }

  listWithCounts() {
    return this.database
      .prepare(
        `
      SELECT t.*, COUNT(at.asset_id) AS asset_count FROM tags t
      LEFT JOIN asset_tags at ON at.tag_id = t.id
      GROUP BY t.id ORDER BY t.name COLLATE NOCASE
    `,
      )
      .all();
  }

  detach(assetId: string, tagId: string) {
    this.database
      .prepare('DELETE FROM asset_tags WHERE asset_id = ? AND tag_id = ?')
      .run(assetId, tagId);
  }

  bulkAttach(assetIds: string[], tagIds: string[], now = Date.now()) {
    withTransaction(this.database, () => {
      const insert = this.database.prepare(`
        INSERT OR IGNORE INTO asset_tags(asset_id, tag_id, created_at) VALUES (?, ?, ?)
      `);
      for (const assetId of assetIds) for (const tagId of tagIds) insert.run(assetId, tagId, now);
    });
  }

  bulkDetach(assetIds: string[], tagIds: string[]) {
    withTransaction(this.database, () => {
      const remove = this.database.prepare(
        'DELETE FROM asset_tags WHERE asset_id = ? AND tag_id = ?',
      );
      for (const assetId of assetIds) for (const tagId of tagIds) remove.run(assetId, tagId);
    });
  }

  rename(id: string, name: string, now = Date.now()) {
    const normalized = name.trim();
    if (!normalized) throw new Error('标签名称不能为空');
    this.database
      .prepare('UPDATE tags SET name = ?, updated_at = ? WHERE id = ?')
      .run(normalized, now, id);
  }

  remove(id: string) {
    this.database.prepare('DELETE FROM tags WHERE id = ?').run(id);
  }
}
