import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { LibraryPaths } from './libraryPaths';

const MAX_GENERATED_IMAGE_BYTES = 50 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;

const mimeExtensions: Record<string, string> = {
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/tiff': '.tiff',
  'image/webp': '.webp',
};

const formatMime: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  tiff: 'image/tiff',
  webp: 'image/webp',
};

export interface GeneratedFileReference {
  absolutePath: string;
  volumeId: string;
  fileName: string;
  extension: string;
  mimeType: string;
  fileSize: number;
  fileCreatedAt: number;
  fileModifiedAt: number;
  contentHash: string;
}

export interface StoredGeneratedImage {
  reference: GeneratedFileReference;
  sourceUrl: string | null;
}

const assertSupportedMime = (mimeType: string) => {
  const normalized = mimeType.split(';', 1)[0].trim().toLowerCase();
  if (!mimeExtensions[normalized]) throw new Error('生成结果不是受支持的图片格式');
  return normalized;
};

const dataUrl = (value: string) => {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/i.exec(value.trim());
  if (!match) return null;
  const mimeType = assertSupportedMime(match[1]);
  const payload = match[3];
  const bytes = match[2]
    ? Buffer.from(payload.replace(/\s/g, ''), 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');
  if (!bytes.length || bytes.length > MAX_GENERATED_IMAGE_BYTES) {
    throw new Error('生成图片超过 50MB 限制或内容为空');
  }
  return { bytes, mimeType };
};

const writeRemoteImage = async (url: string, target: string) => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('生成图片地址无效');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('只支持 http(s) 生成图片地址');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(parsed, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`下载生成图片失败（HTTP ${response.status}）`);
    const mimeType = assertSupportedMime(response.headers.get('content-type') || '');
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_GENERATED_IMAGE_BYTES) throw new Error('生成图片超过 50MB 限制');
    if (!response.body) throw new Error('生成图片响应为空');

    const handle = await fs.open(target, 'w');
    let bytesWritten = 0;
    try {
      for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        bytesWritten += buffer.length;
        if (bytesWritten > MAX_GENERATED_IMAGE_BYTES) throw new Error('生成图片超过 50MB 限制');
        await handle.write(buffer);
      }
    } finally {
      await handle.close();
    }
    if (!bytesWritten) throw new Error('生成图片响应为空');
    return mimeType;
  } finally {
    clearTimeout(timeout);
  }
};

const actualFormat = (format: string | undefined, declaredMime: string) => {
  const mimeType = format ? formatMime[format.toLowerCase()] : undefined;
  if (!mimeType || !mimeExtensions[mimeType]) return declaredMime;
  return mimeType;
};

export const storeGeneratedImage = async (
  paths: LibraryPaths,
  source: string,
  assetId: string = randomUUID(),
): Promise<StoredGeneratedImage> => {
  const sourceUrl = /^https?:\/\//i.test(source.trim()) ? source.trim() : null;
  const directory = path.join(paths.managedAssets, 'generated');
  const temporary = path.join(paths.taskTemp, `${randomUUID()}.image.part`);
  await fs.mkdir(directory, { recursive: true });
  await fs.mkdir(paths.taskTemp, { recursive: true });

  try {
    const inline = dataUrl(source);
    const declaredMime = inline
      ? inline.mimeType
      : await writeRemoteImage(source, temporary);
    if (inline) await fs.writeFile(temporary, inline.bytes, { flag: 'wx' });

    const metadata = await sharp(temporary, {
      failOn: 'warning',
      limitInputPixels: 80_000_000,
      unlimited: false,
      sequentialRead: true,
      pages: 1,
    }).metadata();
    if (!metadata.format || !metadata.width || !metadata.height) {
      throw new Error('生成图片内容无法解析');
    }
    const mimeType = actualFormat(metadata.format, declaredMime);
    const extension = mimeExtensions[mimeType];
    if (!extension) throw new Error('生成图片格式不受支持');

    const finalName = `${assetId}${extension}`;
    const absolutePath = path.join(directory, finalName);
    await fs.rename(temporary, absolutePath);
    const stat = await fs.stat(absolutePath);
    const hash = createHash('sha256');
    const file = await fs.open(absolutePath, 'r');
    try {
      for await (const chunk of file.readableWebStream()) hash.update(Buffer.from(chunk));
    } finally {
      await file.close();
    }
    return {
      sourceUrl,
      reference: {
        absolutePath,
        volumeId: `dev:${stat.dev}`,
        fileName: finalName,
        extension,
        mimeType,
        fileSize: stat.size,
        fileCreatedAt: Math.trunc(stat.birthtimeMs),
        fileModifiedAt: Math.trunc(stat.mtimeMs),
        contentHash: hash.digest('hex'),
      },
    };
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
};

export const removeStoredGeneratedImage = async (stored: StoredGeneratedImage) => {
  await fs.rm(stored.reference.absolutePath, { force: true });
};
