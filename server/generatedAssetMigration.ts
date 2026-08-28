import type { DatabaseSync } from 'node:sqlite';
import type { LibraryPaths } from './libraryPaths';
import { storeGeneratedImage, removeStoredGeneratedImage } from './generatedAssetStorage';
import { PreviewService } from './previews/PreviewService';
import { AssetRepository } from './repositories/AssetRepository';

interface LegacyGeneratedAssetRow {
  id: string;
  user_metadata: string;
}

export interface GeneratedAssetMigrationResult {
  scanned: number;
  restored: number;
  markedUnrecoverable: number;
  skipped: number;
}

const parseMetadata = (value: string) => {
  try {
    const parsed = JSON.parse(value || '{}') as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

const isImageGenerationMetadata = (metadata: Record<string, unknown>) =>
  metadata.source === 'image-generation';

const signedUrlExpiry = (source: string) => {
  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    return null;
  }
  const amzDate = parsed.searchParams.get('X-Amz-Date');
  const amzExpires = parsed.searchParams.get('X-Amz-Expires');
  if (!amzDate || !amzExpires || !/^\d{8}T\d{6}Z$/i.test(amzDate)) return null;
  const expiresSeconds = Number(amzExpires);
  if (!Number.isFinite(expiresSeconds) || expiresSeconds < 0) return null;
  const year = Number(amzDate.slice(0, 4));
  const month = Number(amzDate.slice(4, 6));
  const day = Number(amzDate.slice(6, 8));
  const hour = Number(amzDate.slice(9, 11));
  const minute = Number(amzDate.slice(11, 13));
  const second = Number(amzDate.slice(13, 15));
  const issuedAt = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isFinite(issuedAt)) return null;
  return issuedAt + expiresSeconds * 1000;
};

const isExpiredSignedUrl = (source: string, now = Date.now()) => {
  const expiresAt = signedUrlExpiry(source);
  return expiresAt != null && expiresAt <= now;
};

const markUnrecoverable = (
  database: DatabaseSync,
  row: LegacyGeneratedAssetRow,
  metadata: Record<string, unknown>,
  reason: string,
) => {
  database
    .prepare('UPDATE assets SET user_metadata = ?, updated_at = ? WHERE id = ?')
    .run(
      JSON.stringify({
        ...metadata,
        generatedSourceStatus: 'unrecoverable',
        generatedSourceError: reason,
        generatedSourceCheckedAt: Date.now(),
      }),
      Date.now(),
      row.id,
    );
};

/**
 * Restores legacy generated images that were stored only as inline data URLs.
 * Remote URLs are attempted once; failures are persisted so a restart does not
 * repeatedly request an expired signed URL.
 */
export const migrateLegacyGeneratedAssets = async (input: {
  database: DatabaseSync;
  paths: LibraryPaths;
  assets: AssetRepository;
  previews: PreviewService;
}): Promise<GeneratedAssetMigrationResult> => {
  const rows = input.database
    .prepare(
      `
      SELECT a.id, a.user_metadata
      FROM assets a
      WHERE a.type = 'image'
        AND NOT EXISTS (
          SELECT 1 FROM file_references fr WHERE fr.asset_id = a.id
        )
      ORDER BY a.created_at, a.id
    `,
    )
    .all() as unknown as LegacyGeneratedAssetRow[];
  const result: GeneratedAssetMigrationResult = {
    scanned: rows.length,
    restored: 0,
    markedUnrecoverable: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const metadata = parseMetadata(row.user_metadata);
    if (!isImageGenerationMetadata(metadata)) {
      result.skipped += 1;
      continue;
    }
    if (metadata.generatedSourceStatus === 'unrecoverable') {
      result.skipped += 1;
      continue;
    }
    const source = typeof metadata.generatedUrl === 'string' ? metadata.generatedUrl.trim() : '';
    if (!source) {
      markUnrecoverable(input.database, row, metadata, '生成记录没有保留原图地址');
      result.markedUnrecoverable += 1;
      continue;
    }
    if (isExpiredSignedUrl(source)) {
      markUnrecoverable(input.database, row, metadata, '原图签名地址已过期');
      result.markedUnrecoverable += 1;
      continue;
    }

    let stored: Awaited<ReturnType<typeof storeGeneratedImage>> | null = null;
    try {
      stored = await storeGeneratedImage(input.paths, source, row.id);
      input.assets.addFileReference(row.id, stored.reference);
      input.database
        .prepare(
          `
          UPDATE assets SET content_hash = COALESCE(content_hash, ?), source_url = COALESCE(source_url, ?),
            user_metadata = ?, updated_at = ? WHERE id = ?
        `,
        )
        .run(
          stored.reference.contentHash,
          stored.sourceUrl,
          JSON.stringify({ ...metadata, generatedSourceStatus: 'restored' }),
          Date.now(),
          row.id,
        );
      try {
        await input.previews.generateImage(row.id, 512);
      } catch (error) {
        console.warn(`[资产兼容迁移] ${row.id} 已恢复原图，但预览生成失败：${String(error)}`);
      }
      result.restored += 1;
    } catch (error) {
      if (stored) await removeStoredGeneratedImage(stored);
      const reason = error instanceof Error ? error.message : String(error);
      markUnrecoverable(input.database, row, metadata, `原图地址不可访问：${reason}`);
      result.markedUnrecoverable += 1;
    }
  }

  return result;
};
