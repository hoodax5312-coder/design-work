import fs from 'node:fs/promises';
import sharp from 'sharp';
import type { LibraryRuntime } from './libraryRuntime';

const fail = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};

/** Resolve only registered originals, never a client path, URL, or cached thumbnail. */
export const readReferenceImageAsset = async (runtime: LibraryRuntime, assetId: unknown) => {
  if (typeof assetId !== 'string' || !assetId || assetId.length > 200) fail('参考图必须指定有效资产 ID');
  const asset = runtime.assets.get(assetId as string);
  if (!asset || asset.status === 'deleted') return fail('参考图资产不存在或已删除', 404);
  if (asset.type !== 'image') fail('参考图资产必须是图片');
  const row = runtime.database.prepare(
    'SELECT absolute_path FROM file_references WHERE asset_id = ? ORDER BY created_at LIMIT 1',
  ).get(assetId as string) as { absolute_path: string } | undefined;
  if (!row) return fail('参考图没有保存到本地的原文件', 404);
  const file = await fs.open(row.absolute_path, 'r').catch(() => fail('参考图原文件不可读取', 404));
  try {
    const stat = await file.stat();
    if (!stat.isFile() || !stat.size || stat.size > 10 * 1024 * 1024) fail('参考图必须是不超过 10 MB 的非空图片');
    const bytes = await file.readFile();
    if (bytes.length > 10 * 1024 * 1024) fail('参考图超过 10 MB');
    const metadata = await sharp(bytes, { animated: true }).metadata().catch(() => fail('参考图原文件不是有效图片'));
    if (!metadata.format || !['png', 'jpeg', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) {
      fail('参考图仅支持静态 PNG、JPEG 或 WebP 原图');
    }
    return { bytes, mimeType: `image/${metadata.format}`, name: `reference.${metadata.format === 'jpeg' ? 'jpg' : metadata.format}` };
  } finally {
    await file.close();
  }
};
