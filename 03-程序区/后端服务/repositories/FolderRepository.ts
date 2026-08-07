import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface FolderRecord {
  id: string;
  parentId: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
}

const mapFolder = (row: Record<string, unknown>): FolderRecord => ({
  id: String(row.id),
  parentId: row.parent_id == null ? null : String(row.parent_id),
  name: String(row.name),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
});

export class FolderRepository {
  constructor(private readonly database: DatabaseSync) {}

  create(name: string, parentId: string | null = null, now = Date.now()) {
    const id = randomUUID();
    this.database
      .prepare(
        `
      INSERT INTO folders(id, parent_id, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(id, parentId, name.trim(), now, now);
    return mapFolder(
      this.database.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Record<
        string,
        unknown
      >,
    );
  }

  list(parentId: string | null = null) {
    const rows =
      parentId == null
        ? this.database
            .prepare('SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name COLLATE NOCASE')
            .all()
        : this.database
            .prepare('SELECT * FROM folders WHERE parent_id = ? ORDER BY name COLLATE NOCASE')
            .all(parentId);
    return rows.map(mapFolder);
  }

  listWithCounts() {
    return this.database
      .prepare(
        `
      SELECT f.*, COUNT(a.id) AS asset_count FROM folders f
      LEFT JOIN assets a ON a.primary_folder_id = f.id AND a.status <> 'deleted'
      GROUP BY f.id ORDER BY f.name COLLATE NOCASE
    `,
      )
      .all()
      .map((row) => ({ ...mapFolder(row), assetCount: Number(row.asset_count) }));
  }

  rename(id: string, name: string, now = Date.now()) {
    const normalized = name.trim();
    if (!normalized) throw new Error('文件夹名称不能为空');
    this.database
      .prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?')
      .run(normalized, now, id);
    const row = this.database.prepare('SELECT * FROM folders WHERE id = ?').get(id);
    if (!row) throw new Error('文件夹不存在');
    return mapFolder(row);
  }

  remove(id: string) {
    this.database.prepare('DELETE FROM folders WHERE id = ?').run(id);
  }
}
