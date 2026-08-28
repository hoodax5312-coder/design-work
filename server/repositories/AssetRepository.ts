import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { withTransaction } from '../database';

export interface AssetRecord {
  id: string;
  type: string;
  title: string;
  description: string;
  contentHash: string | null;
  primaryFolderId: string | null;
  favorite: boolean;
  rating: number;
  sourceUrl: string | null;
  author: string | null;
  licenseNote: string | null;
  status: string;
  rawMetadata: Record<string, unknown>;
  normalizedMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
  createdAt: number;
  importedAt: number;
  updatedAt: number;
  lastAccessedAt: number | null;
}

export interface CreateAssetInput {
  id?: string;
  type: string;
  title: string;
  description?: string;
  contentHash?: string | null;
  sourceUrl?: string | null;
  primaryFolderId?: string | null;
  favorite?: boolean;
  rating?: number;
  status?: string;
  rawMetadata?: Record<string, unknown>;
  normalizedMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
  extractedText?: string;
  fileReference?: AssetFileReferenceInput;
  now?: number;
}

export interface AssetFileReferenceInput {
  absolutePath: string;
  volumeId?: string | null;
  fileName: string;
  extension: string;
  mimeType?: string | null;
  fileSize: number;
  fileCreatedAt?: number | null;
  fileModifiedAt?: number | null;
  contentHash?: string | null;
  status?: string;
}

export interface UpdateAssetInput {
  title?: string;
  description?: string;
  primaryFolderId?: string | null;
  favorite?: boolean;
  rating?: number;
  sourceUrl?: string | null;
  author?: string | null;
  licenseNote?: string | null;
  userMetadata?: Record<string, unknown>;
}

export interface SearchAssetsInput {
  query?: string;
  type?: string;
  types?: string[];
  folderId?: string | null;
  unfiled?: boolean;
  tagIds?: string[];
  favorite?: boolean;
  ratingMin?: number;
  status?: string;
  createdFrom?: number;
  createdTo?: number;
  limit?: number;
  offset?: number;
  sort?: 'updatedAt' | 'title' | 'rating' | 'createdAt';
}

export interface AssetSearchPage {
  items: AssetRecord[];
  total: number;
  limit: number;
  offset: number;
}

const parseJson = (value: unknown) => JSON.parse(String(value || '{}')) as Record<string, unknown>;

const mapAsset = (row: Record<string, unknown>): AssetRecord => ({
  id: String(row.id),
  type: String(row.type),
  title: String(row.title),
  description: String(row.description),
  contentHash: row.content_hash == null ? null : String(row.content_hash),
  primaryFolderId: row.primary_folder_id == null ? null : String(row.primary_folder_id),
  favorite: Boolean(row.favorite),
  rating: Number(row.rating),
  sourceUrl: row.source_url == null ? null : String(row.source_url),
  author: row.author == null ? null : String(row.author),
  licenseNote: row.license_note == null ? null : String(row.license_note),
  status: String(row.status),
  rawMetadata: parseJson(row.raw_metadata),
  normalizedMetadata: parseJson(row.normalized_metadata),
  userMetadata: parseJson(row.user_metadata),
  createdAt: Number(row.created_at),
  importedAt: Number(row.imported_at),
  updatedAt: Number(row.updated_at),
  lastAccessedAt: row.last_accessed_at == null ? null : Number(row.last_accessed_at),
});

const buildSearch = (input: SearchAssetsInput) => {
  const conditions: string[] = [];
  const parameters: SQLInputValue[] = [];
  const joins: string[] = [];
  const tagIds = [...new Set(input.tagIds || [])];
  const types = [...new Set(input.types || (input.type ? [input.type] : []))];

  if (input.status && input.status !== 'all') {
    conditions.push('a.status = ?');
    parameters.push(input.status);
  } else if (input.status !== 'all') {
    conditions.push("a.status <> 'deleted'");
  }
  if (input.query?.trim()) {
    joins.push('JOIN asset_fts ON asset_fts.asset_id = a.id');
    conditions.push('asset_fts MATCH ?');
    parameters.push(input.query.trim());
  }
  if (types.length) {
    conditions.push(`a.type IN (${types.map(() => '?').join(', ')})`);
    parameters.push(...types);
  }
  if (input.unfiled) conditions.push('a.primary_folder_id IS NULL');
  else if (input.folderId) {
    conditions.push('a.primary_folder_id = ?');
    parameters.push(input.folderId);
  }
  if (typeof input.favorite === 'boolean') {
    conditions.push('a.favorite = ?');
    parameters.push(input.favorite ? 1 : 0);
  }
  if (input.ratingMin != null) {
    conditions.push('a.rating >= ?');
    parameters.push(Math.min(Math.max(input.ratingMin, 0), 5));
  }
  if (input.createdFrom != null) {
    conditions.push('a.created_at >= ?');
    parameters.push(input.createdFrom);
  }
  if (input.createdTo != null) {
    conditions.push('a.created_at <= ?');
    parameters.push(input.createdTo);
  }
  if (tagIds.length) {
    for (const tagId of tagIds) {
      conditions.push(`EXISTS (
        SELECT 1 FROM asset_tags filter_tag
        WHERE filter_tag.asset_id = a.id AND filter_tag.tag_id = ?
      )`);
      parameters.push(tagId);
    }
  }
  return { joins, conditions, parameters };
};

export class AssetRepository {
  constructor(private readonly database: DatabaseSync) {}

  private insertFileReference(assetId: string, reference: AssetFileReferenceInput, now: number) {
    const id = randomUUID();
    this.database
      .prepare(
        `
      INSERT INTO file_references(
        id, asset_id, absolute_path, volume_id, file_name, extension, mime_type,
        file_size, file_created_at, file_modified_at, content_hash, last_accessible_at,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        assetId,
        reference.absolutePath,
        reference.volumeId ?? null,
        reference.fileName,
        reference.extension,
        reference.mimeType ?? null,
        reference.fileSize,
        reference.fileCreatedAt ?? null,
        reference.fileModifiedAt ?? null,
        reference.contentHash ?? null,
        now,
        reference.status || 'online',
        now,
        now,
      );
    return id;
  }

  create(input: CreateAssetInput): AssetRecord {
    const id = input.id || randomUUID();
    const now = input.now || Date.now();
    withTransaction(this.database, () => {
      this.database
        .prepare(
          `
        INSERT INTO assets(
          id, type, title, description, content_hash, primary_folder_id,
          favorite, rating, source_url, status, raw_metadata, normalized_metadata, user_metadata,
          created_at, imported_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          id,
          input.type,
          input.title,
          input.description || '',
          input.contentHash ?? null,
          input.primaryFolderId ?? null,
          input.favorite ? 1 : 0,
          input.rating || 0,
          input.sourceUrl ?? null,
          input.status || 'active',
          JSON.stringify(input.rawMetadata || {}),
          JSON.stringify(input.normalizedMetadata || {}),
          JSON.stringify(input.userMetadata || {}),
          now,
          now,
          now,
        );
      this.database
        .prepare(
          `
        INSERT INTO asset_fts(asset_id, title, description, extracted_text) VALUES (?, ?, ?, ?)
      `,
        )
        .run(id, input.title, input.description || '', input.extractedText || '');
      if (input.fileReference) {
        this.insertFileReference(id, input.fileReference, now);
      }
    });
    return this.get(id) as AssetRecord;
  }

  addFileReference(assetId: string, reference: AssetFileReferenceInput, now = Date.now()) {
    return withTransaction(this.database, () => this.insertFileReference(assetId, reference, now));
  }

  get(id: string): AssetRecord | null {
    const row = this.database.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    return row ? mapAsset(row) : null;
  }

  search(input: SearchAssetsInput = {}): AssetRecord[] {
    return this.searchPage(input).items;
  }

  searchPage(input: SearchAssetsInput = {}): AssetSearchPage {
    const { joins, conditions, parameters } = buildSearch(input);
    const sortExpressions = {
      updatedAt: 'a.updated_at DESC, a.id',
      createdAt: 'a.created_at DESC, a.id',
      title: 'a.title COLLATE NOCASE, a.id',
      rating: 'a.rating DESC, a.updated_at DESC, a.id',
    } as const;
    const limit = Math.min(Math.max(input.limit || 100, 1), 500);
    const offset = Math.max(input.offset || 0, 0);
    const from = `FROM assets a ${joins.join('\n')} WHERE ${conditions.length ? conditions.join(' AND ') : '1 = 1'}`;
    const items = this.database
      .prepare(
        `
      SELECT a.* ${from}
      ORDER BY ${sortExpressions[input.sort || 'updatedAt']} LIMIT ? OFFSET ?
    `,
      )
      .all(...parameters, limit, offset)
      .map(mapAsset);
    const total = Number(
      this.database.prepare(`SELECT COUNT(*) AS count ${from}`).get(...parameters)?.count || 0,
    );
    return { items, total, limit, offset };
  }

  update(id: string, input: UpdateAssetInput, now = Date.now()) {
    const current = this.get(id);
    if (!current) throw new Error('资产不存在');
    const title = input.title === undefined ? current.title : input.title.trim();
    if (!title) throw new Error('资产标题不能为空');
    const description = input.description === undefined ? current.description : input.description;
    const userMetadata =
      input.userMetadata === undefined
        ? current.userMetadata
        : { ...current.userMetadata, ...input.userMetadata };
    const extracted = this.database
      .prepare(
        `
      SELECT extracted_text FROM asset_fts WHERE asset_id = ?
    `,
      )
      .get(id)?.extracted_text;
    withTransaction(this.database, () => {
      this.database
        .prepare(
          `
        UPDATE assets SET title = ?, description = ?, primary_folder_id = ?, favorite = ?,
          rating = ?, source_url = ?, author = ?, license_note = ?, user_metadata = ?, updated_at = ?
        WHERE id = ?
      `,
        )
        .run(
          title,
          description,
          input.primaryFolderId === undefined ? current.primaryFolderId : input.primaryFolderId,
          input.favorite === undefined ? (current.favorite ? 1 : 0) : input.favorite ? 1 : 0,
          input.rating === undefined ? current.rating : Math.min(Math.max(input.rating, 0), 5),
          input.sourceUrl === undefined ? current.sourceUrl : input.sourceUrl,
          input.author === undefined ? current.author : input.author,
          input.licenseNote === undefined ? current.licenseNote : input.licenseNote,
          JSON.stringify(userMetadata),
          now,
          id,
        );
      this.database.prepare('DELETE FROM asset_fts WHERE asset_id = ?').run(id);
      this.database
        .prepare(
          `
        INSERT INTO asset_fts(asset_id, title, description, extracted_text) VALUES (?, ?, ?, ?)
      `,
        )
        .run(id, title, description, extracted == null ? '' : String(extracted));
    });
    return this.get(id) as AssetRecord;
  }

  updateSearchText(id: string, extractedText: string) {
    const asset = this.get(id);
    if (!asset) throw new Error('资产不存在');
    withTransaction(this.database, () => {
      this.database.prepare('DELETE FROM asset_fts WHERE asset_id = ?').run(id);
      this.database
        .prepare(
          `
        INSERT INTO asset_fts(asset_id, title, description, extracted_text) VALUES (?, ?, ?, ?)
      `,
        )
        .run(id, asset.title, asset.description, extractedText);
    });
  }

  softDelete(id: string, now = Date.now()) {
    this.database
      .prepare(`UPDATE assets SET status = 'deleted', updated_at = ? WHERE id = ?`)
      .run(now, id);
  }

  restore(id: string, now = Date.now()) {
    this.database
      .prepare(`UPDATE assets SET status = 'active', updated_at = ? WHERE id = ?`)
      .run(now, id);
  }

  bulkMove(assetIds: string[], folderId: string | null, now = Date.now()) {
    const update = this.database.prepare(
      'UPDATE assets SET primary_folder_id = ?, updated_at = ? WHERE id = ?',
    );
    withTransaction(this.database, () => assetIds.forEach((id) => update.run(folderId, now, id)));
  }

  bulkFavorite(assetIds: string[], favorite: boolean, now = Date.now()) {
    const update = this.database.prepare(
      'UPDATE assets SET favorite = ?, updated_at = ? WHERE id = ?',
    );
    withTransaction(this.database, () =>
      assetIds.forEach((id) => update.run(favorite ? 1 : 0, now, id)),
    );
  }
}
