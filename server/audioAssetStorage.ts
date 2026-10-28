import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { LibraryRuntime } from './libraryRuntime';

export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

const AUDIO_FORMATS = {
  mp3: { extension: 'mp3', mimeType: 'audio/mpeg' },
  wav: { extension: 'wav', mimeType: 'audio/wav' },
  m4a: { extension: 'm4a', mimeType: 'audio/mp4' },
  aac: { extension: 'aac', mimeType: 'audio/aac' },
  flac: { extension: 'flac', mimeType: 'audio/flac' },
  ogg: { extension: 'ogg', mimeType: 'audio/ogg' },
} as const;

export type AudioFormat = keyof typeof AUDIO_FORMATS;

const fail = (message: string, status = 400): never => {
  throw Object.assign(new Error(message), { status });
};

/** 按文件头识别音频格式，不信任扩展名或供应商声明的 Content-Type。 */
export const sniffAudioFormat = (bytes: Uint8Array): AudioFormat | null => {
  const ascii = (start: number, length: number) => Buffer.from(bytes.subarray(start, start + length)).toString('latin1');
  if (bytes.length < 12) return null;
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return 'wav';
  if (ascii(0, 4) === 'fLaC') return 'flac';
  if (ascii(0, 4) === 'OggS') return 'ogg';
  if (ascii(4, 4) === 'ftyp') return 'm4a';
  if (ascii(0, 3) === 'ID3') return 'mp3';
  if (bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) return 'aac';
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'mp3';
  return null;
};

export const audioMimeType = (format: AudioFormat) => AUDIO_FORMATS[format].mimeType;

/** 把已校验的音频字节写入本机资产目录并登记为 audio 资产；失败时清理写出的文件。 */
export const storeAudioAsset = async (
  runtime: LibraryRuntime,
  bytes: Uint8Array,
  input: { title: string; description?: string; userMetadata?: Record<string, unknown> },
) => {
  if (!bytes.length) fail('音频内容为空');
  if (bytes.length > MAX_AUDIO_BYTES) fail('音频不能超过 100 MB');
  const format = sniffAudioFormat(bytes);
  if (!format) fail('文件内容不是可识别的 MP3、WAV、M4A、AAC、FLAC 或 OGG 音频');
  const { extension, mimeType } = AUDIO_FORMATS[format as AudioFormat];
  const assetId = randomUUID();
  const directory = path.join(runtime.paths.managedAssets, 'audio');
  await fs.mkdir(directory, { recursive: true });
  const fileName = `${assetId}.${extension}`;
  const absolutePath = path.join(directory, fileName);
  await fs.writeFile(absolutePath, bytes, { flag: 'wx' });
  try {
    const stat = await fs.stat(absolutePath);
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const asset = runtime.assets.create({
      id: assetId,
      type: 'audio',
      title: input.title.trim().slice(0, 200) || '未命名音频',
      description: input.description || '',
      contentHash,
      userMetadata: { ...(input.userMetadata || {}), mimeType },
      fileReference: {
        absolutePath,
        volumeId: `dev:${stat.dev}`,
        fileName,
        extension,
        mimeType,
        fileSize: stat.size,
        fileCreatedAt: Math.trunc(stat.birthtimeMs),
        fileModifiedAt: Math.trunc(stat.mtimeMs),
        contentHash,
      },
    });
    return { asset, mimeType };
  } catch (error) {
    await fs.rm(absolutePath, { force: true });
    throw error;
  }
};
