import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { atomicWriteFile } from './atomicFile';
import { withTransaction } from './database';
import type { LibraryRuntime } from './libraryRuntime';

type SourceRow = {
  id: string;
  name: string;
  manifest_url: string;
  homepage_url: string | null;
  enabled: number;
  last_attempt_at: number | null;
  last_success_at: number | null;
  item_count: number;
  error_message: string | null;
  cache_path: string | null;
  created_at: number;
  updated_at: number;
};
type CatalogSource = {
  id: string;
  name: string;
  manifestUrl?: string;
  homepageUrl: string | null;
  itemCount: number;
};
type CatalogSourceRow = CatalogSource & {
  prompt_source_id: string;
  enabled: number;
  sort_order: number;
  updated_at: number;
  deleted_at: number | null;
};
const toSource = (row: SourceRow) => ({
  id: row.id,
  name: row.name,
  manifestUrl: row.manifest_url,
  homepageUrl: row.homepage_url,
  enabled: Boolean(row.enabled),
  lastAttemptAt: row.last_attempt_at,
  lastSuccessAt: row.last_success_at,
  itemCount: row.item_count,
  errorMessage: row.error_message,
  cachePath: row.cache_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
const safeUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Manifest URL 无效');
  const url = new URL(value);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new Error('仅允许 HTTPS 或本机 HTTP 地址');
  return url.toString();
};
const fetchJson = async (initialUrl: string, maxBytes: number) => {
  let url = initialUrl;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirect === 3) throw new Error('Manifest 重定向次数超过限制');
      url = safeUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Manifest 请求失败 (${response.status})`);
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > maxBytes) throw new Error('Manifest 响应超过大小限制');
    if (!response.body) return response.json();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('Manifest 响应超过大小限制');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  throw new Error('Manifest 重定向失败');
};
const bodyObject = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const normalizeItems = (value: unknown, sourceId: string, sourceUrl: string) => {
  const list = Array.isArray(value) ? value : bodyObject(value).prompts;
  if (!Array.isArray(list)) throw new Error('提示词数据格式无效');
  return list.flatMap((item, index) => {
    const object = bodyObject(item);
    const prompt = typeof object.prompt === 'string' ? object.prompt.trim() : '';
    if (!prompt) return [];
    return [
      {
        id: String(object.id || `${sourceId}:${index + 1}`),
        sourceId:
          typeof object.sourceId === 'string' && object.sourceId.trim()
            ? object.sourceId
            : sourceId,
        title: String(object.title || object.name || `案例 ${index + 1}`),
        prompt,
        description: String(object.description || ''),
        coverUrl: typeof object.coverUrl === 'string' ? object.coverUrl : null,
        tags: Array.isArray(object.tags)
          ? object.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        author: typeof object.author === 'string' ? object.author : '',
        sourceUrl: typeof object.sourceUrl === 'string' ? object.sourceUrl : sourceUrl,
        imageModel: typeof object.imageModel === 'string' ? object.imageModel : '',
      },
    ];
  });
};
const getRows = (db: DatabaseSync) =>
  db
    .prepare('SELECT * FROM prompt_sources ORDER BY created_at ASC')
    .all() as unknown as SourceRow[];
const getCatalogRows = (db: DatabaseSync) =>
  db
    .prepare(
      'SELECT pcs.id, pcs.name, ps.manifest_url AS manifestUrl, pcs.homepage_url AS homepageUrl, pcs.item_count AS itemCount, pcs.prompt_source_id, pcs.enabled, pcs.sort_order, pcs.updated_at, pcs.deleted_at FROM prompt_catalog_sources pcs JOIN prompt_sources ps ON ps.id = pcs.prompt_source_id WHERE pcs.deleted_at IS NULL ORDER BY pcs.sort_order ASC, pcs.updated_at ASC, pcs.id ASC',
    )
    .all() as unknown as CatalogSourceRow[];
const getAllCatalogRows = (db: DatabaseSync) =>
  db
    .prepare(
      'SELECT pcs.id, pcs.name, ps.manifest_url AS manifestUrl, pcs.homepage_url AS homepageUrl, pcs.item_count AS itemCount, pcs.prompt_source_id, pcs.enabled, pcs.sort_order, pcs.updated_at, pcs.deleted_at FROM prompt_catalog_sources pcs JOIN prompt_sources ps ON ps.id = pcs.prompt_source_id ORDER BY pcs.sort_order ASC, pcs.updated_at ASC, pcs.id ASC',
    )
    .all() as unknown as CatalogSourceRow[];
const hydrateCatalogRows = async (runtime: LibraryRuntime) => {
  if (getCatalogRows(runtime.database).length) return;
  const rows = getRows(runtime.database);
  const entries: Array<{ sourceId: string; catalog: CatalogSource[] }> = [];
  for (const row of rows) {
    if (!row.cache_path) continue;
    try {
      const data = JSON.parse(await fs.readFile(row.cache_path, 'utf8')) as {
        sources?: CatalogSource[];
      };
      if (Array.isArray(data.sources)) entries.push({ sourceId: row.id, catalog: data.sources });
    } catch {
      /* a missing cache is rebuilt by the next sync */
    }
  }
  if (!entries.length) return;
  withTransaction(runtime.database, () => {
    let order = 0;
    entries.forEach(({ sourceId, catalog }) =>
      catalog.forEach((entry) =>
        runtime.database
          .prepare(
            'INSERT OR IGNORE INTO prompt_catalog_sources(id, prompt_source_id, name, homepage_url, enabled, sort_order, item_count, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
          )
          .run(
            entry.id,
            sourceId,
            entry.name,
            entry.homepageUrl,
            order++,
            entry.itemCount,
            Date.now(),
          ),
      ),
    );
  });
};
const readCases = async (runtime: LibraryRuntime, queryValue: unknown, sourceValue: unknown) => {
  const query = String(queryValue || '').toLowerCase();
  const source = String(sourceValue || '');
  const rows = getRows(runtime.database).filter((row) => row.enabled);
  const catalogRows = getCatalogRows(runtime.database);
  const caches = await Promise.all(
    rows.map(async (row) => {
      if (!row.cache_path) return { items: [], sources: [] as CatalogSource[] };
      try {
        const data = JSON.parse(await fs.readFile(row.cache_path, 'utf8'));
        return {
          items: Array.isArray(data.items) ? data.items : [],
          sources: Array.isArray(data.sources) ? (data.sources as CatalogSource[]) : [],
        };
      } catch {
        return { items: [], sources: [] as CatalogSource[] };
      }
    }),
  );
  const cachedSources = caches.flatMap((cache) => cache.sources);
  const enabledManifestIds = new Set(rows.map((row) => row.id));
  const catalog = catalogRows.length
    ? catalogRows
        .filter((entry) => entry.enabled && enabledManifestIds.has(entry.prompt_source_id))
        .map(({ id, name, homepageUrl, itemCount }) => ({ id, name, homepageUrl, itemCount }))
    : cachedSources.length
      ? cachedSources
      : rows.map((row) => ({
          id: row.id,
          name: row.name,
          homepageUrl: row.homepage_url,
          itemCount: row.item_count,
        }));
  const enabledIds = new Set(catalog.map((entry) => entry.id));
  const hasCatalog = catalogRows.length > 0 || cachedSources.length > 0;
  const items = caches
    .flatMap((cache) => cache.items)
    .filter((item) => !hasCatalog || enabledIds.has(item.sourceId))
    .filter((item) => !source || item.sourceId === source)
    .filter(
      (item) =>
        !query ||
        `${item.title} ${item.prompt} ${item.description} ${(item.tags || []).join(' ')}`
          .toLowerCase()
          .includes(query),
    );
  return { items, total: items.length, sources: catalog };
};
const syncSource = async (runtime: LibraryRuntime, source: SourceRow) => {
  const now = Date.now();
  runtime.database
    .prepare(
      'UPDATE prompt_sources SET last_attempt_at=?, error_message=NULL, updated_at=? WHERE id=?',
    )
    .run(now, now, source.id);
  try {
    const manifest = bodyObject(await fetchJson(source.manifest_url, 10 * 1024 * 1024));
    const promptsPath = typeof manifest.promptsPath === 'string' ? manifest.promptsPath : '';
    const promptsUrl = promptsPath
      ? new URL(promptsPath, source.manifest_url).toString()
      : source.manifest_url;
    const promptsData =
      promptsUrl === source.manifest_url
        ? manifest
        : await fetchJson(safeUrl(promptsUrl), 50 * 1024 * 1024);
    const items = normalizeItems(
      promptsData,
      source.id,
      source.homepage_url || source.manifest_url,
    );
    const manifestSources = Array.isArray(manifest.sources) ? manifest.sources : [];
    const sources: CatalogSource[] = manifestSources.flatMap((entry) => {
      const object = bodyObject(entry);
      const id = typeof object.id === 'string' ? object.id : '';
      const name = typeof object.name === 'string' ? object.name : '';
      if (!id || !name) return [];
      const count = items.filter((item) => item.sourceId === id).length;
      return [
        {
          id,
          name,
          homepageUrl: typeof object.homepage === 'string' ? object.homepage : null,
          itemCount: count,
        },
      ];
    });
    const existingCatalog = new Map(
      getAllCatalogRows(runtime.database)
        .filter((entry) => entry.prompt_source_id === source.id)
        .map((entry) => [entry.id, entry]),
    );
    const nowCatalog = Date.now();
    withTransaction(runtime.database, () => {
      const maxOrder = Number(
        runtime.database
          .prepare('SELECT COALESCE(MAX(sort_order), -1) AS value FROM prompt_catalog_sources')
          .get()?.value || -1,
      );
      sources.forEach((entry, index) => {
        const previous = existingCatalog.get(entry.id);
        if (previous?.deleted_at) return;
        runtime.database
          .prepare(
            `INSERT INTO prompt_catalog_sources(id, prompt_source_id, name, homepage_url, enabled, sort_order, item_count, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET prompt_source_id=excluded.prompt_source_id, item_count=excluded.item_count, updated_at=excluded.updated_at`,
          )
          .run(
            entry.id,
            source.id,
            previous ? previous.name : entry.name,
            previous ? previous.homepageUrl : entry.homepageUrl,
            previous?.enabled ?? 1,
            previous?.sort_order ?? maxOrder + index + 1,
            entry.itemCount,
            nowCatalog,
          );
      });
    });
    const sourceHomepages = new Map(sources.map((entry) => [entry.id, entry.homepageUrl]));
    items.forEach((item) => {
      const homepage = sourceHomepages.get(item.sourceId);
      if (
        homepage &&
        (!item.sourceUrl ||
          item.sourceUrl === source.homepage_url ||
          item.sourceUrl === source.manifest_url)
      )
        item.sourceUrl = homepage;
    });
    const cachePath = path.join(runtime.paths.modules.promptSources, `${source.id}.json`);
    await atomicWriteFile(
      cachePath,
      JSON.stringify({ source: toSource(source), syncedAt: now, sources, items }, null, 2),
    );
    runtime.database
      .prepare(
        'UPDATE prompt_sources SET last_success_at=?, item_count=?, cache_path=?, error_message=NULL, updated_at=? WHERE id=?',
      )
      .run(now, items.length, cachePath, now, source.id);
    return {
      ...toSource(source),
      lastAttemptAt: now,
      lastSuccessAt: now,
      itemCount: items.length,
      cachePath,
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '同步失败';
    runtime.database
      .prepare('UPDATE prompt_sources SET error_message=?, updated_at=? WHERE id=?')
      .run(message, Date.now(), source.id);
    throw new Error(message);
  }
};

export const createPromptSourcesRouter = (getRuntime: () => Promise<LibraryRuntime>) => {
  const router = Router();
  router.get('/', async (_req, res, next) => {
    try {
      const runtime = await getRuntime();
      res.json({ items: getRows(runtime.database).map(toSource) });
    } catch (e) {
      next(e);
    }
  });
  router.get('/catalog', async (_req, res, next) => {
    try {
      const runtime = await getRuntime();
      await hydrateCatalogRows(runtime);
      res.json({
        items: getCatalogRows(runtime.database).map(
          ({
            id,
            name,
            manifestUrl,
            homepageUrl,
            itemCount,
            enabled,
            prompt_source_id: manifestId,
          }) => ({
            id,
            manifestId,
            name,
            manifestUrl,
            homepageUrl,
            itemCount,
            enabled: Boolean(enabled),
          }),
        ),
      });
    } catch (e) {
      next(e);
    }
  });
  router.patch('/catalog/order', async (req, res, next) => {
    try {
      const runtime = await getRuntime();
      const ids: string[] = Array.isArray(req.body?.ids)
        ? req.body.ids.filter((id: unknown): id is string => typeof id === 'string')
        : [];
      const current = getCatalogRows(runtime.database);
      const known = new Set(current.map((entry) => entry.id));
      if (ids.length !== current.length || ids.some((id) => !known.has(id)))
        throw new Error('来源排序数据无效');
      withTransaction(runtime.database, () =>
        ids.forEach((id, index) =>
          runtime.database
            .prepare('UPDATE prompt_catalog_sources SET sort_order=?, updated_at=? WHERE id=?')
            .run(index, Date.now(), id),
        ),
      );
      res.json({
        items: getCatalogRows(runtime.database).map(
          ({
            id,
            name,
            manifestUrl,
            homepageUrl,
            itemCount,
            enabled,
            prompt_source_id: manifestId,
          }) => ({
            id,
            manifestId,
            name,
            manifestUrl,
            homepageUrl,
            itemCount,
            enabled: Boolean(enabled),
          }),
        ),
      });
    } catch (e) {
      next(e);
    }
  });
  router.patch('/catalog/:id', async (req, res, next) => {
    try {
      const runtime = await getRuntime();
      const current = getCatalogRows(runtime.database).find((entry) => entry.id === req.params.id);
      if (!current) return res.status(404).json({ error: '来源不存在' });
      const body = bodyObject(req.body);
      const name = body.name == null ? current.name : String(body.name).trim();
      if (!name) throw new Error('来源名称不能为空');
      const homepage =
        body.homepageUrl === undefined
          ? current.homepageUrl
          : body.homepageUrl
            ? safeUrl(body.homepageUrl)
            : null;
      const enabled = body.enabled === undefined ? current.enabled : body.enabled ? 1 : 0;
      runtime.database
        .prepare(
          'UPDATE prompt_catalog_sources SET name=?, homepage_url=?, enabled=?, updated_at=? WHERE id=?',
        )
        .run(name, homepage, enabled, Date.now(), req.params.id);
      const updated = getCatalogRows(runtime.database).find((entry) => entry.id === req.params.id)!;
      res.json({
        id: updated.id,
        manifestId: updated.prompt_source_id,
        name: updated.name,
        homepageUrl: updated.homepageUrl,
        itemCount: updated.itemCount,
        enabled: Boolean(updated.enabled),
      });
    } catch (e) {
      next(e);
    }
  });
  router.delete('/catalog/:id', async (req, res, next) => {
    try {
      const runtime = await getRuntime();
      const current = getCatalogRows(runtime.database).find((entry) => entry.id === req.params.id);
      if (!current) return res.status(404).json({ error: '来源不存在' });
      runtime.database
        .prepare('UPDATE prompt_catalog_sources SET deleted_at=?, updated_at=? WHERE id=?')
        .run(Date.now(), Date.now(), req.params.id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  router.get('/cases', async (req, res, next) => {
    try {
      res.json(await readCases(await getRuntime(), req.query.query, req.query.source));
    } catch (e) {
      next(e);
    }
  });
  router.post('/', async (req, res, next) => {
    try {
      const runtime = await getRuntime();
      const body = bodyObject(req.body);
      const name = String(body.name || '').trim();
      if (!name) throw new Error('来源名称不能为空');
      const manifestUrl = safeUrl(body.manifestUrl);
      const now = Date.now();
      const id = crypto.randomUUID();
      runtime.database
        .prepare(
          'INSERT INTO prompt_sources(id,name,manifest_url,homepage_url,enabled,created_at,updated_at) VALUES (?,?,?,?,1,?,?)',
        )
        .run(id, name, manifestUrl, body.homepageUrl ? safeUrl(body.homepageUrl) : null, now, now);
      res.status(201).json(toSource(getRows(runtime.database).find((row) => row.id === id)!));
    } catch (e) {
      next(e);
    }
  });
  router.patch('/:id', async (req, res, next) => {
    try {
      const runtime = await getRuntime();
      const current = getRows(runtime.database).find((row) => row.id === req.params.id);
      if (!current) return res.status(404).json({ error: '来源不存在' });
      const body = bodyObject(req.body);
      const name = body.name == null ? current.name : String(body.name).trim();
      const url = body.manifestUrl == null ? current.manifest_url : safeUrl(body.manifestUrl);
      const homepage =
        body.homepageUrl === undefined
          ? current.homepage_url
          : body.homepageUrl
            ? safeUrl(body.homepageUrl)
            : null;
      const enabled = body.enabled === undefined ? current.enabled : body.enabled ? 1 : 0;
      const now = Date.now();
      runtime.database
        .prepare(
          'UPDATE prompt_sources SET name=?,manifest_url=?,homepage_url=?,enabled=?,updated_at=? WHERE id=?',
        )
        .run(name, url, homepage, enabled, now, req.params.id);
      res.json(toSource(getRows(runtime.database).find((row) => row.id === req.params.id)!));
    } catch (e) {
      next(e);
    }
  });
  router.delete('/:id', async (req, res, next) => {
    try {
      const runtime = await getRuntime();
      const current = getRows(runtime.database).find((row) => row.id === req.params.id);
      if (!current) return res.status(404).json({ error: '来源不存在' });
      runtime.database.prepare('DELETE FROM prompt_sources WHERE id=?').run(req.params.id);
      if (current.cache_path) await fs.rm(current.cache_path, { force: true });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  router.post('/:id/sync', async (req, res, next) => {
    try {
      const runtime = await getRuntime();
      const source = getRows(runtime.database).find((row) => row.id === req.params.id);
      if (!source) return res.status(404).json({ error: '来源不存在' });
      res.json(await syncSource(runtime, source));
    } catch (e) {
      next(e);
    }
  });
  router.post('/sync', async (_req, res, next) => {
    try {
      const runtime = await getRuntime();
      const results = await Promise.allSettled(
        getRows(runtime.database)
          .filter((row) => row.enabled)
          .map((row) => syncSource(runtime, row)),
      );
      res.json({
        items: results.map((result) =>
          result.status === 'fulfilled'
            ? result.value
            : { error: result.reason instanceof Error ? result.reason.message : '同步失败' },
        ),
      });
    } catch (e) {
      next(e);
    }
  });
  return router;
};

export const createCasesRouter = (getRuntime: () => Promise<LibraryRuntime>) => {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      res.json(await readCases(await getRuntime(), req.query.query, req.query.source));
    } catch (e) {
      next(e);
    }
  });
  return router;
};
