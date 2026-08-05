import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { withTransaction } from '../database';
import type { LibraryPaths } from '../libraryPaths';
import { resolveWithinLibrary } from '../libraryPaths';
import { PreviewRepository } from '../repositories/PreviewRepository';
import { ImagePreviewProvider } from './ImagePreviewProvider';
import type { PreviewProvider } from './PreviewProvider';

export const previewSizes = [256, 512, 1024] as const;
export type PreviewSize = (typeof previewSizes)[number];

export class PreviewSourceChangedError extends Error {
  constructor() {
    super('原文件已修改，需要重新校验后再生成预览');
  }
}

interface FileReferenceRow {
  absolute_path: string;
  file_size: number;
  file_modified_at: number | null;
  content_hash: string | null;
  status: string;
}

export class PreviewService {
  readonly repository: PreviewRepository;

  constructor(
    private readonly database: DatabaseSync,
    private readonly paths: LibraryPaths,
    private readonly imageProvider: PreviewProvider = new ImagePreviewProvider(),
  ) {
    this.repository = new PreviewRepository(database);
  }

  async generateImage(assetId: string, size: PreviewSize = 512) {
    if (!previewSizes.includes(size)) throw new Error('不支持的预览尺寸');
    const reference = this.database
      .prepare(
        `
      SELECT absolute_path, file_size, file_modified_at, content_hash, status
      FROM file_references WHERE asset_id = ? AND status = 'online'
      ORDER BY last_accessible_at DESC, created_at LIMIT 1
    `,
      )
      .get(assetId) as FileReferenceRow | undefined;
    if (!reference) throw new Error('资产没有可访问的原文件');

    const stat = await fs.stat(reference.absolute_path);
    if (
      stat.size !== Number(reference.file_size) ||
      (reference.file_modified_at != null &&
        Math.trunc(stat.mtimeMs) !== Math.trunc(reference.file_modified_at))
    ) {
      withTransaction(this.database, () => {
        this.database
          .prepare(
            `
          UPDATE file_references SET status = 'changed', updated_at = ? WHERE absolute_path = ?
        `,
          )
          .run(Date.now(), reference.absolute_path);
        this.repository.markStale(assetId);
      });
      throw new PreviewSourceChangedError();
    }

    const sourceHash =
      reference.content_hash ||
      createHash('sha256').update(`${stat.size}:${stat.mtimeMs}`).digest('hex');
    const kind = `thumbnail:${size}`;
    const existing = this.repository.find(assetId, kind, this.imageProvider.version);
    if (existing?.status === 'ready' && existing.sourceHash === sourceHash) {
      const existingPath = resolveWithinLibrary(this.paths.root, existing.cachePath);
      try {
        await fs.access(existingPath);
        this.repository.touch(existing.id);
        return { artifact: existing, absolutePath: existingPath, reused: true };
      } catch {
        this.repository.markStale(assetId);
      }
    }

    const relativeTarget = path.join('thumbnails', assetId, `${sourceHash}-${size}.webp`);
    const target = resolveWithinLibrary(this.paths.root, relativeTarget);
    const temporary = path.join(this.paths.taskTemp, `${randomUUID()}.webp.part`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.mkdir(this.paths.taskTemp, { recursive: true });
    try {
      const result = await this.imageProvider.generate({
        sourcePath: reference.absolute_path,
        outputPath: temporary,
        maxWidth: size,
        maxHeight: size,
      });
      await fs.rename(temporary, target);
      const artifact = this.repository.upsert({
        assetId,
        kind,
        cachePath: relativeTarget,
        sourceHash,
        generatorVersion: this.imageProvider.version,
        fileSize: result.fileSize,
        metadata: { ...result },
      });
      const asset = this.database
        .prepare('SELECT normalized_metadata FROM assets WHERE id = ?')
        .get(assetId);
      const normalized = asset
        ? (JSON.parse(String(asset.normalized_metadata || '{}')) as Record<string, unknown>)
        : {};
      this.database
        .prepare(
          `
        UPDATE assets SET normalized_metadata = ?, updated_at = ? WHERE id = ?
      `,
        )
        .run(JSON.stringify({ ...normalized, image: result }), Date.now(), assetId);
      if (existing && existing.cachePath !== relativeTarget) {
        await fs.rm(resolveWithinLibrary(this.paths.root, existing.cachePath), { force: true });
      }
      return { artifact, absolutePath: target, reused: false };
    } catch (error) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
  }

  async getReadyPath(assetId: string, size: PreviewSize = 512) {
    const artifact = this.repository.latest(assetId, `thumbnail:${size}`);
    if (!artifact || artifact.status !== 'ready') return null;
    const absolutePath = resolveWithinLibrary(this.paths.root, artifact.cachePath);
    try {
      await fs.access(absolutePath);
      this.repository.touch(artifact.id);
      return absolutePath;
    } catch {
      this.repository.markStale(assetId);
      return null;
    }
  }

  async evict(artifactId: string) {
    const artifact = this.repository
      .listEvictable(1000)
      .find((candidate) => candidate.id === artifactId);
    if (!artifact) throw new Error('预览不存在或已被永久保留');
    await fs.rm(resolveWithinLibrary(this.paths.root, artifact.cachePath), { force: true });
    this.repository.remove(artifact.id);
  }
}
