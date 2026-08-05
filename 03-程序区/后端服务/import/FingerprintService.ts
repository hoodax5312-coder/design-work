import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';

export interface FingerprintProgress {
  bytesRead: number;
  totalBytes: number;
}

export interface FingerprintOptions {
  signal?: AbortSignal;
  onProgress?: (progress: FingerprintProgress) => void;
}

export interface QuickFingerprint {
  key: string;
  fileSize: number;
  fileModifiedAt: number;
}

export class FileChangedDuringReadError extends Error {
  constructor(readonly absolutePath: string) {
    super(`读取期间文件已发生变化：${absolutePath}`);
  }
}

const abortError = () => new DOMException('指纹计算已取消', 'AbortError');

const assertNotAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw abortError();
};

const sameSnapshot = (
  before: { size: number; mtimeMs: number },
  after: { size: number; mtimeMs: number },
) => before.size === after.size && before.mtimeMs === after.mtimeMs;

export class FingerprintService {
  constructor(private readonly sampleBytes = 64 * 1024) {}

  async quick(absolutePath: string, options: FingerprintOptions = {}): Promise<QuickFingerprint> {
    assertNotAborted(options.signal);
    const before = await fs.stat(absolutePath);
    if (!before.isFile()) throw new Error('指纹计算仅支持普通文件');
    const handle = await fs.open(absolutePath, 'r');
    try {
      const headLength = Math.min(before.size, this.sampleBytes);
      const tailLength = Math.min(Math.max(before.size - headLength, 0), this.sampleBytes);
      const head = Buffer.alloc(headLength);
      const tail = Buffer.alloc(tailLength);
      if (headLength) await handle.read(head, 0, headLength, 0);
      assertNotAborted(options.signal);
      if (tailLength) await handle.read(tail, 0, tailLength, before.size - tailLength);
      assertNotAborted(options.signal);
      const after = await handle.stat();
      if (!sameSnapshot(before, after)) throw new FileChangedDuringReadError(absolutePath);
      const key = createHash('sha256')
        .update(String(before.size))
        .update(':')
        .update(head)
        .update(tail)
        .digest('hex');
      options.onProgress?.({ bytesRead: headLength + tailLength, totalBytes: before.size });
      return { key, fileSize: before.size, fileModifiedAt: before.mtimeMs };
    } finally {
      await handle.close();
    }
  }

  async full(absolutePath: string, options: FingerprintOptions = {}) {
    assertNotAborted(options.signal);
    const before = await fs.stat(absolutePath);
    if (!before.isFile()) throw new Error('指纹计算仅支持普通文件');
    const hash = createHash('sha256');
    const stream = createReadStream(absolutePath);
    const onAbort = () => stream.destroy(abortError());
    options.signal?.addEventListener('abort', onAbort, { once: true });
    let bytesRead = 0;
    try {
      for await (const chunk of stream) {
        assertNotAborted(options.signal);
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        hash.update(buffer);
        bytesRead += buffer.length;
        options.onProgress?.({ bytesRead, totalBytes: before.size });
      }
      const after = await fs.stat(absolutePath);
      if (!sameSnapshot(before, after)) throw new FileChangedDuringReadError(absolutePath);
      return hash.digest('hex');
    } finally {
      options.signal?.removeEventListener('abort', onAbort);
    }
  }
}
