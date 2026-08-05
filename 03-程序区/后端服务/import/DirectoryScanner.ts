import fs from 'node:fs/promises';
import path from 'node:path';

export interface DiscoveredFile {
  absolutePath: string;
  fileName: string;
  extension: string;
  proposedMimeType: string | null;
  fileSize: number;
  fileCreatedAt: number;
  fileModifiedAt: number;
  volumeId: string;
  volumeLabel: string;
}

export interface ScanIssue {
  absolutePath: string;
  code: string;
  message: string;
}

export interface ScanResult {
  files: DiscoveredFile[];
  issues: ScanIssue[];
  directoriesScanned: number;
}

export interface ScanOptions {
  signal?: AbortSignal;
  maxFiles?: number;
  onProgress?: (progress: {
    filesDiscovered: number;
    directoriesScanned: number;
    currentPath: string;
  }) => void;
}

export class ScanLimitExceededError extends Error {
  constructor(readonly limit: number) {
    super(`扫描文件数超过上限 ${limit}`);
  }
}

const mimeByExtension: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
};

const abortError = () => new DOMException('扫描已取消', 'AbortError');

const assertNotAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw abortError();
};

const volumeLabelForPath = (absolutePath: string) => {
  const segments = path.resolve(absolutePath).split(path.sep).filter(Boolean);
  if (segments[0] === 'Volumes' && segments[1]) return segments[1];
  return path.parse(absolutePath).root;
};

const issueFromError = (absolutePath: string, error: unknown): ScanIssue => ({
  absolutePath,
  code: (error as NodeJS.ErrnoException).code || 'SCAN_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export class DirectoryScanner {
  async scan(inputPaths: string[], options: ScanOptions = {}): Promise<ScanResult> {
    const maxFiles = Math.min(Math.max(options.maxFiles || 100_000, 1), 1_000_000);
    const files: DiscoveredFile[] = [];
    const issues: ScanIssue[] = [];
    const directories: string[] = [];
    let directoriesScanned = 0;

    const addFile = async (absolutePath: string) => {
      assertNotAborted(options.signal);
      if (files.length >= maxFiles) throw new ScanLimitExceededError(maxFiles);
      const stats = await fs.lstat(absolutePath);
      if (stats.isSymbolicLink()) {
        issues.push({ absolutePath, code: 'SYMLINK_SKIPPED', message: '不跟随符号链接' });
        return;
      }
      if (!stats.isFile()) return;
      const extension = path.extname(absolutePath).toLowerCase();
      files.push({
        absolutePath: path.resolve(absolutePath),
        fileName: path.basename(absolutePath),
        extension,
        proposedMimeType: mimeByExtension[extension] || null,
        fileSize: stats.size,
        fileCreatedAt: stats.birthtimeMs,
        fileModifiedAt: stats.mtimeMs,
        volumeId: `dev:${stats.dev}`,
        volumeLabel: volumeLabelForPath(absolutePath),
      });
      options.onProgress?.({
        filesDiscovered: files.length,
        directoriesScanned,
        currentPath: absolutePath,
      });
    };

    for (const inputPath of [...new Set(inputPaths.map((value) => path.resolve(value)))]) {
      assertNotAborted(options.signal);
      try {
        const stats = await fs.lstat(inputPath);
        if (stats.isSymbolicLink()) {
          issues.push({
            absolutePath: inputPath,
            code: 'SYMLINK_SKIPPED',
            message: '不跟随符号链接',
          });
        } else if (stats.isDirectory()) {
          directories.push(inputPath);
        } else if (stats.isFile()) {
          await addFile(inputPath);
        }
      } catch (error) {
        issues.push(issueFromError(inputPath, error));
      }
    }

    while (directories.length) {
      assertNotAborted(options.signal);
      const directory = directories.shift() as string;
      try {
        const handle = await fs.opendir(directory);
        directoriesScanned += 1;
        for await (const entry of handle) {
          assertNotAborted(options.signal);
          const absolutePath = path.join(directory, entry.name);
          if (entry.isSymbolicLink()) {
            issues.push({ absolutePath, code: 'SYMLINK_SKIPPED', message: '不跟随符号链接' });
          } else if (entry.isDirectory()) {
            directories.push(absolutePath);
          } else if (entry.isFile()) {
            try {
              await addFile(absolutePath);
            } catch (error) {
              if (error instanceof ScanLimitExceededError || (error as Error).name === 'AbortError')
                throw error;
              issues.push(issueFromError(absolutePath, error));
            }
          }
        }
      } catch (error) {
        if (error instanceof ScanLimitExceededError || (error as Error).name === 'AbortError')
          throw error;
        issues.push(issueFromError(directory, error));
      }
    }

    return { files, issues, directoriesScanned };
  }
}
