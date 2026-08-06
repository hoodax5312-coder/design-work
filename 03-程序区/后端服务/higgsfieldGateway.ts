import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';

const API_ORIGIN = 'https://fnf.higgsfield.ai';

const fetchJson = async <T>(pathname: string): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`${API_ORIGIN}${pathname}`, {
        headers: {
          Accept: 'application/json',
          Origin: 'https://higgsfield.ai',
          Referer: 'https://higgsfield.ai/',
          'User-Agent': 'Design Work-Local-Project-Workbench/0.1',
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Higgsfield API ${response.status}: ${pathname}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Higgsfield API 请求失败: ${pathname}`);
};

interface FolderPage {
  items: Array<{ id: string; name: string }>;
  cursor?: string | number | null;
  sort_order_cursor?: string | number | null;
}

interface ItemPage {
  items: unknown[];
  cursor?: string | number | null;
}

interface PublicationPage {
  items: Array<{
    publication_id: string;
    name: string;
    slug: string;
    snapshot_folder_id: string;
    cover?: { url?: string; type?: string } | null;
    gallery_media?: Array<{ url?: string; type?: string }>;
  }>;
  next_cursor?: string | number | null;
}

interface AuditFile {
  url: string;
  type: 'image' | 'video' | 'other';
  bytes: number | null;
  reachable: boolean;
  status: number | null;
}

interface ProjectAudit {
  publicationId: string;
  name: string;
  slug: string;
  rootFolderId: string;
  folders: number;
  generations: number;
  images: number;
  videos: number;
  files: number;
  bytes: number;
  unknownSizeFiles: number;
  unreachableFiles: number;
  duplicateUrls: number;
  manifestPath: string;
}

interface AuditState {
  status: 'idle' | 'running' | 'complete' | 'failed' | 'cancelled';
  startedAt: string | null;
  finishedAt: string | null;
  currentProject: string | null;
  projectsDiscovered: number;
  projectsScanned: number;
  foldersScanned: number;
  generations: number;
  filesDiscovered: number;
  filesMeasured: number;
  images: number;
  videos: number;
  totalBytes: number;
  unknownSizeFiles: number;
  unreachableFiles: number;
  duplicateUrls: number;
  mediaBytesDownloaded: number;
  projects: ProjectAudit[];
  reportPath: string | null;
  error: string | null;
}

const createAuditState = (): AuditState => ({
  status: 'idle',
  startedAt: null,
  finishedAt: null,
  currentProject: null,
  projectsDiscovered: 0,
  projectsScanned: 0,
  foldersScanned: 0,
  generations: 0,
  filesDiscovered: 0,
  filesMeasured: 0,
  images: 0,
  videos: 0,
  totalBytes: 0,
  unknownSizeFiles: 0,
  unreachableFiles: 0,
  duplicateUrls: 0,
  mediaBytesDownloaded: 0,
  projects: [],
  reportPath: null,
  error: null,
});

let auditState = createAuditState();
let cancelAuditRequested = false;

const safeSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '');

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const mediaType = (url: string, declaredType?: string): AuditFile['type'] => {
  if (declaredType === 'video' || /\.(mp4|mov|webm|m3u8)(\?|$)/i.test(url)) return 'video';
  if (declaredType === 'image' || declaredType === 'media' || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) return 'image';
  return 'other';
};

const extractJobMedia = (item: unknown): { url: string; type: AuditFile['type'] } | null => {
  const job = asRecord(asRecord(item)?.job);
  if (!job) return null;
  const results = asRecord(job.results);
  const media = asRecord(results?.raw) || asRecord(job.result);
  const url = typeof media?.url === 'string' ? media.url : '';
  if (!url) return null;
  return { url, type: mediaType(url, typeof media?.type === 'string' ? media.type : undefined) };
};

const measureHttpObject = async (url: string): Promise<AuditFile> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const type = mediaType(url);
  try {
    const head = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': 'Design Work-Capacity-Audit/0.1' },
      signal: controller.signal,
    });
    const length = Number(head.headers.get('content-length') || 0);
    if (head.ok && length > 0) return { url, type, bytes: length, reachable: true, status: head.status };

    const range = await fetch(url, {
      headers: { Range: 'bytes=0-0', 'User-Agent': 'Design Work-Capacity-Audit/0.1' },
      redirect: 'follow',
      signal: controller.signal,
    });
    const contentRange = range.headers.get('content-range') || '';
    const rangeTotal = Number(contentRange.match(/\/(\d+)$/)?.[1] || 0);
    const rangeLength = Number(range.headers.get('content-length') || 0);
    const bytes = rangeTotal || (range.status === 200 ? rangeLength : 0);
    return {
      url,
      type,
      bytes: bytes > 0 ? bytes : null,
      reachable: range.ok,
      status: range.status,
    };
  } catch {
    return { url, type, bytes: null, reachable: false, status: null };
  } finally {
    clearTimeout(timeout);
  }
};

const measureHls = async (url: string, depth = 0): Promise<AuditFile> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Design Work-Capacity-Audit/0.1' },
      signal: controller.signal,
    });
    if (!response.ok) return { url, type: 'video', bytes: null, reachable: false, status: response.status };
    const playlist = await response.text();
    const lines = playlist.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    if (depth < 2 && lines.some((line) => line.startsWith('#EXT-X-STREAM-INF'))) {
      const variants: Array<{ bandwidth: number; url: string }> = [];
      lines.forEach((line, index) => {
        if (!line.startsWith('#EXT-X-STREAM-INF')) return;
        const bandwidth = Number(line.match(/BANDWIDTH=(\d+)/)?.[1] || 0);
        const nextLine = lines.slice(index + 1).find((candidate) => !candidate.startsWith('#'));
        if (nextLine) variants.push({ bandwidth, url: new URL(nextLine, url).toString() });
      });
      const highest = variants.sort((a, b) => b.bandwidth - a.bandwidth)[0];
      if (highest) return measureHls(highest.url, depth + 1);
    }

    const segmentUrls = lines
      .filter((line) => !line.startsWith('#'))
      .filter((line) => !line.toLowerCase().includes('.m3u8'))
      .map((line) => new URL(line, url).toString());
    if (!segmentUrls.length) return { url, type: 'video', bytes: null, reachable: true, status: response.status };

    const segments: AuditFile[] = [];
    for (let index = 0; index < segmentUrls.length; index += 4) {
      segments.push(...(await Promise.all(segmentUrls.slice(index, index + 4).map(measureHttpObject))));
    }
    const bytes = segments.reduce((sum, segment) => sum + (segment.bytes || 0), 0);
    return {
      url,
      type: 'video',
      bytes: bytes > 0 ? bytes : null,
      reachable: segments.some((segment) => segment.reachable),
      status: response.status,
    };
  } catch {
    return { url, type: 'video', bytes: null, reachable: false, status: null };
  } finally {
    clearTimeout(timeout);
  }
};

const measureRemoteFile = (url: string): Promise<AuditFile> =>
  /\.m3u8(\?|$)/i.test(url) ? measureHls(url) : measureHttpObject(url);

const mapWithConcurrency = async <T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await worker(values[index]);
    }
  });
  await Promise.all(runners);
  return results;
};

const readAllPublications = async () => {
  const projects: PublicationPage['items'] = [];
  let cursor: string | number | null | undefined;
  do {
    const query = cursor ? `?cursor=${encodeURIComponent(String(cursor))}` : '';
    const page = await fetchJson<PublicationPage>(`/project-publications${query}`);
    projects.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor && !cancelAuditRequested);
  return projects;
};

const persistAuditState = async (auditRoot: string) => {
  await fs.mkdir(auditRoot, { recursive: true });
  await fs.writeFile(path.join(auditRoot, 'status.json'), JSON.stringify(auditState, null, 2), 'utf8');
};

const runCapacityAudit = async (projectRoot: string) => {
  const auditRoot = path.join(projectRoot, '.design-work', 'higgsfield-audit');
  const projectReportsDir = path.join(auditRoot, 'projects');
  await fs.mkdir(projectReportsDir, { recursive: true });
  const measuredFiles = new Map<string, AuditFile>();

  try {
    const publications = await readAllPublications();
    auditState.projectsDiscovered = publications.length;
    await persistAuditState(auditRoot);

    for (const publication of publications) {
      if (cancelAuditRequested) break;
      auditState.currentProject = publication.name;
      const queue = [publication.snapshot_folder_id];
      const visited = new Set<string>();
      const projectUrls = new Map<string, AuditFile['type']>();
      let generations = 0;
      let duplicates = 0;

      const addUrl = (url?: string, declaredType?: string) => {
        if (!url) return;
        if (projectUrls.has(url)) duplicates += 1;
        else projectUrls.set(url, mediaType(url, declaredType));
      };
      addUrl(publication.cover?.url, publication.cover?.type);
      publication.gallery_media?.forEach((media) => addUrl(media.url, media.type));

      while (queue.length && !cancelAuditRequested) {
        const folderId = queue.shift();
        if (!folderId || visited.has(folderId)) continue;
        visited.add(folderId);
        auditState.foldersScanned += 1;

        const children = await fetchJson<FolderPage>(
          `/folders/${folderId}/children?size=100&sort_by=sort_order`,
        );
        children.items.forEach((folder) => queue.push(safeSegment(folder.id)));

        let cursor: string | number | null | undefined;
        do {
          const cursorQuery = cursor ? `&cursor=${encodeURIComponent(String(cursor))}` : '';
          const page = await fetchJson<ItemPage>(
            `/folders/${folderId}/items/v2?include_subfolders=false&size=100${cursorQuery}`,
          );
          generations += page.items.length;
          page.items.forEach((item) => {
            const media = extractJobMedia(item);
            if (media) addUrl(media.url, media.type);
          });
          cursor = page.cursor;
        } while (cursor && !cancelAuditRequested);
      }

      const urls = [...projectUrls.keys()];
      auditState.filesDiscovered += urls.length;
      const knownBeforeProject = new Set(measuredFiles.keys());
      const files = await mapWithConcurrency(urls, 4, async (url) => {
        const existing = measuredFiles.get(url);
        if (existing) {
          duplicates += 1;
          return existing;
        }
        const measured = await measureRemoteFile(url);
        measuredFiles.set(url, measured);
        auditState.filesMeasured += 1;
        return measured;
      });

      const bytes = files.reduce((sum, file) => sum + (file.bytes || 0), 0);
      const newUniqueBytes = files.reduce(
        (sum, file, index) => sum + (knownBeforeProject.has(urls[index]) ? 0 : file.bytes || 0),
        0,
      );
      const unknownSizeFiles = files.filter((file) => file.bytes === null).length;
      const unreachableFiles = files.filter((file) => !file.reachable).length;
      const images = files.filter((file) => file.type === 'image').length;
      const videos = files.filter((file) => file.type === 'video').length;
      const manifestPath = path.join(projectReportsDir, `${safeSegment(publication.slug) || publication.publication_id}.json`);
      const projectAudit: ProjectAudit = {
        publicationId: publication.publication_id,
        name: publication.name,
        slug: publication.slug,
        rootFolderId: publication.snapshot_folder_id,
        folders: visited.size,
        generations,
        images,
        videos,
        files: files.length,
        bytes,
        unknownSizeFiles,
        unreachableFiles,
        duplicateUrls: duplicates,
        manifestPath,
      };
      await fs.writeFile(
        manifestPath,
        JSON.stringify({ ...projectAudit, scannedAt: new Date().toISOString(), files }, null, 2),
        'utf8',
      );

      auditState.projects.push(projectAudit);
      auditState.projectsScanned += 1;
      auditState.generations += generations;
      auditState.images += images;
      auditState.videos += videos;
      auditState.totalBytes += newUniqueBytes;
      auditState.unknownSizeFiles += unknownSizeFiles;
      auditState.unreachableFiles += unreachableFiles;
      auditState.duplicateUrls += duplicates;
      await persistAuditState(auditRoot);
    }

    auditState.status = cancelAuditRequested ? 'cancelled' : 'complete';
    auditState.finishedAt = new Date().toISOString();
    auditState.currentProject = null;
    auditState.reportPath = path.join(auditRoot, 'manifest.json');
    await fs.writeFile(auditState.reportPath, JSON.stringify(auditState, null, 2), 'utf8');
    await persistAuditState(auditRoot);
  } catch (error) {
    auditState.status = 'failed';
    auditState.finishedAt = new Date().toISOString();
    auditState.error = error instanceof Error ? error.message : '未知扫描错误';
    await persistAuditState(auditRoot);
  }
};

export const createHiggsfieldRouter = (projectRoot: string) => {
  const router = Router();

  router.get('/projects', async (request, response, next) => {
    try {
      const category = String(request.query.category || '').trim();
      const query = category ? `?category=${encodeURIComponent(category)}` : '';
      response.json(await fetchJson(`/project-publications${query}`));
    } catch (error) {
      next(error);
    }
  });

  router.get('/folders/:folderId', async (request, response, next) => {
    try {
      response.json(await fetchJson(`/folders/${safeSegment(request.params.folderId)}`));
    } catch (error) {
      next(error);
    }
  });

  router.get('/folders/:folderId/children', async (request, response, next) => {
    try {
      const folderId = safeSegment(request.params.folderId);
      response.json(await fetchJson(`/folders/${folderId}/children?size=100&sort_by=sort_order`));
    } catch (error) {
      next(error);
    }
  });

  router.get('/folders/:folderId/items', async (request, response, next) => {
    try {
      const folderId = safeSegment(request.params.folderId);
      const size = Math.min(Math.max(Number(request.query.size || 48), 1), 100);
      const cursor = request.query.cursor ? `&cursor=${encodeURIComponent(String(request.query.cursor))}` : '';
      response.json(
        await fetchJson(`/folders/${folderId}/items/v2?include_subfolders=true&size=${size}${cursor}`),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post('/sync/:folderId', async (request, response, next) => {
    try {
      const rootFolderId = safeSegment(request.params.folderId);
      const syncRoot = path.join(projectRoot, '.design-work', 'higgsfield', rootFolderId);
      const foldersDir = path.join(syncRoot, 'folders');
      const itemsDir = path.join(syncRoot, 'items');
      await fs.mkdir(foldersDir, { recursive: true });
      await fs.mkdir(itemsDir, { recursive: true });

      const rootFolder = await fetchJson<Record<string, unknown>>(`/folders/${rootFolderId}`);
      await fs.writeFile(path.join(syncRoot, 'project.json'), JSON.stringify(rootFolder, null, 2), 'utf8');

      const queue = [rootFolderId];
      const visited = new Set<string>();
      let assetCount = 0;

      while (queue.length) {
        const folderId = queue.shift();
        if (!folderId || visited.has(folderId)) continue;
        visited.add(folderId);

        const children = await fetchJson<FolderPage>(
          `/folders/${folderId}/children?size=100&sort_by=sort_order`,
        );
        await fs.writeFile(
          path.join(foldersDir, `${folderId}.json`),
          JSON.stringify(children, null, 2),
          'utf8',
        );
        children.items.forEach((folder) => queue.push(safeSegment(folder.id)));

        const assets: unknown[] = [];
        let cursor: string | number | null | undefined;
        do {
          const cursorQuery = cursor ? `&cursor=${encodeURIComponent(String(cursor))}` : '';
          const page = await fetchJson<ItemPage>(
            `/folders/${folderId}/items/v2?include_subfolders=false&size=100${cursorQuery}`,
          );
          assets.push(...page.items);
          cursor = page.cursor;
        } while (cursor);

        assetCount += assets.length;
        await fs.writeFile(
          path.join(itemsDir, `${folderId}.json`),
          JSON.stringify({ items: assets }, null, 2),
          'utf8',
        );
      }

      const manifest = {
        rootFolderId,
        syncedAt: new Date().toISOString(),
        folders: visited.size,
        assets: assetCount,
        mediaDownloaded: false,
      };
      await fs.writeFile(path.join(syncRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
      response.json({ ok: true, path: syncRoot, ...manifest });
    } catch (error) {
      next(error);
    }
  });

  router.get('/audit', async (_request, response, next) => {
    try {
      if (auditState.status === 'idle') {
        const statusPath = path.join(projectRoot, '.design-work', 'higgsfield-audit', 'status.json');
        try {
          const saved = JSON.parse(await fs.readFile(statusPath, 'utf8')) as AuditState;
          if (saved.status !== 'running') auditState = saved;
        } catch {
          // No previous audit is a valid first-run state.
        }
      }
      response.json(auditState);
    } catch (error) {
      next(error);
    }
  });

  router.post('/audit/start', async (_request, response) => {
    if (auditState.status === 'running') {
      response.status(409).json({ error: '容量盘点已在进行中' });
      return;
    }
    cancelAuditRequested = false;
    auditState = {
      ...createAuditState(),
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    void runCapacityAudit(projectRoot);
    response.status(202).json(auditState);
  });

  router.post('/audit/cancel', (_request, response) => {
    cancelAuditRequested = true;
    response.json({ ok: true, status: auditState.status });
  });

  router.use(
    (
      error: Error,
      _request: unknown,
      response: { status: (code: number) => { json: (body: unknown) => void } },
      _next: unknown,
    ) => {
      response.status(502).json({ error: error.message || 'Higgsfield 公开数据读取失败' });
    },
  );

  return router;
};
