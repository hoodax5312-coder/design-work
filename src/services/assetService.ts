import type {
  AssetDetail,
  AssetSummary,
  AssetFolder,
  AssetPage,
  AssetTag,
  DurableTask,
  FileIssue,
  ImportSession,
} from '../types/asset.types';

const request = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error((payload as { error?: string }).error || `请求失败 (${response.status})`);
  return payload as T;
};

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const normalizeAssetPage = (page: Partial<AssetPage> | null | undefined): AssetPage => ({
  items: Array.isArray(page?.items) ? page.items : [],
  total: Number.isFinite(page?.total) ? Number(page?.total) : 0,
  limit: Number.isFinite(page?.limit) ? Number(page?.limit) : 0,
  offset: Number.isFinite(page?.offset) ? Number(page?.offset) : 0,
  counts: {
    all: Number.isFinite(page?.counts?.all) ? Number(page?.counts?.all) : 0,
    unfiled: Number.isFinite(page?.counts?.unfiled) ? Number(page?.counts?.unfiled) : 0,
    byType: Object.fromEntries(
      Object.entries(page?.counts?.byType || {}).map(([type, count]) => [
        type,
        Number.isFinite(count) ? Number(count) : 0,
      ]),
    ),
  },
});

const normalizeTag = (tag: Record<string, unknown>): AssetTag => ({
  id: String(tag.id),
  name: String(tag.name),
  color: tag.color == null ? null : String(tag.color),
  groupName:
    tag.groupName == null && tag.group_name == null
      ? null
      : String(tag.groupName ?? tag.group_name),
  assetCount: Number(tag.assetCount ?? tag.asset_count ?? 0),
});

export interface AssetQuery {
  query?: string;
  type?: string;
  folderId?: string;
  unfiled?: boolean;
  tagId?: string;
  tagIds?: string[];
  favorite?: boolean;
  origin?: 'generated' | 'canvas' | 'uploaded';
  status?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export const assetService = {
  cases: (query = '') => request<{ items: Array<{ id: string; sourceId: string; title: string; prompt: string; description: string; coverUrl: string | null; tags: string[]; author: string; sourceUrl: string; imageModel: string; mediaType?: string; videoUrl?: string | null }>; total: number; sources: Array<{ id: string; name: string; homepageUrl: string | null; itemCount: number }> }>(`/api/cases?query=${encodeURIComponent(query)}`),
  create: (input: {
    type: string;
    title: string;
    description?: string;
    primaryFolderId?: string | null;
    sourceUrl?: string;
    favorite?: boolean;
    userMetadata?: Record<string, unknown>;
  }) => request<AssetSummary>('/api/assets', json(input)),
  list: async (query: AssetQuery = {}) => {
    const parameters = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (key === 'tagIds' && Array.isArray(value)) {
        value.forEach((tagId) => parameters.append('tagId', tagId));
      } else if (value !== undefined && value !== '') {
        parameters.set(key, String(value));
      }
    });
    return normalizeAssetPage(await request<Partial<AssetPage>>(`/api/assets?${parameters}`));
  },
  detail: async (id: string) => {
    const detail = await request<AssetDetail & { tags: Array<Record<string, unknown>> }>(
      `/api/assets/${id}`,
    );
    return { ...detail, tags: detail.tags.map(normalizeTag) } as AssetDetail;
  },
  update: (id: string, input: Record<string, unknown>) =>
    request<AssetDetail>(`/api/assets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  remove: async (id: string) => {
    const response = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('删除资产失败');
  },
  restore: (id: string) => request<AssetDetail>(`/api/assets/${id}/restore`, { method: 'POST' }),
  /** 在访达中显示原文件。 */
  reveal: (id: string) => request<{ ok: true }>(`/api/assets/${id}/reveal`, { method: 'POST' }),
  /** 网关弹窗选择文件夹后复制原文件；取消时 cancelled 为 true。 */
  exportFile: (id: string) =>
    request<{ cancelled: boolean; path?: string }>(`/api/assets/${id}/export`, { method: 'POST' }),
  folders: async () => {
    const result = await request<{ items?: AssetFolder[] }>('/api/assets/folders');
    return Array.isArray(result.items) ? result.items : [];
  },
  createFolder: (name: string, parentId: string | null = null) =>
    request<AssetFolder>('/api/assets/folders', json({ name, parentId })),
  renameFolder: (id: string, name: string) =>
    request<AssetFolder>(`/api/assets/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  deleteFolder: async (id: string) => {
    const response = await fetch(`/api/assets/folders/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('删除文件夹失败');
  },
  tags: async () => {
    const result = await request<{ items?: Array<Record<string, unknown>> }>('/api/assets/tags');
    return (Array.isArray(result.items) ? result.items : []).map(normalizeTag);
  },
  createTag: async (name: string) =>
    normalizeTag(await request<Record<string, unknown>>('/api/assets/tags', json({ name }))),
  renameTag: async (id: string, name: string) =>
    normalizeTag(
      await request<Record<string, unknown>>(`/api/assets/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }),
    ),
  deleteTag: async (id: string) => {
    const response = await fetch(`/api/assets/tags/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('删除标签失败');
  },
  bulkTags: (assetIds: string[], tagIds: string[], action: 'add' | 'remove' = 'add') =>
    request('/api/assets/bulk/tags', json({ assetIds, tagIds, action })),
  bulkMove: (assetIds: string[], folderId: string | null) =>
    request('/api/assets/bulk/move', json({ assetIds, folderId })),
  bulkFavorite: (assetIds: string[], favorite: boolean) =>
    request('/api/assets/bulk/favorite', json({ assetIds, favorite })),
  /** 上传本地音频：原始字节入库并校验文件头，返回音频资产。 */
  uploadAudio: async (file: File) => {
    const response = await fetch('/api/assets/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'x-lizuo-file-name': encodeURIComponent(file.name) },
      body: file,
    });
    const payload = await response.json().catch(() => ({})) as AssetSummary & { error?: string };
    if (!response.ok || !payload.id) throw new Error(payload.error || `音频上传失败 (${response.status})`);
    return payload;
  },
  requestPreview: (assetId: string, size = 512) =>
    request<{ id: string }>(`/api/assets/${assetId}/preview`, json({ size })),
  pickFiles: () =>
    request<{ paths: string[]; cancelled: boolean }>('/api/import/pick-files', { method: 'POST' }),
  pickDirectory: () =>
    request<{ paths: string[]; cancelled: boolean }>('/api/import/pick-directory', {
      method: 'POST',
    }),
  dropImage: async (file: File) => {
    const response = await fetch('/api/import/drop-file', {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Design-Work-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error((payload as { error?: string }).error || `素材入库失败 (${response.status})`);
    return payload as { path: string; originalFileName: string };
  },
  scan: (rootPaths: string[]) => request<{ id: string }>('/api/import/scan', json({ rootPaths })),
  importSession: (id: string) => request<ImportSession>(`/api/import/sessions/${id}`),
  saveImportDecisions: (id: string, decisions: unknown[]) =>
    request<ImportSession>(`/api/import/sessions/${id}/decisions`, json({ decisions })),
  confirmImport: (id: string) =>
    request<{ id: string }>(`/api/import/sessions/${id}/confirm`, { method: 'POST' }),
  tasks: async (status?: string) => {
    const result = await request<{ items: DurableTask[] }>(
      `/api/tasks${status ? `?status=${status}` : ''}`,
    );
    return result.items;
  },
  task: (id: string) => request<DurableTask>(`/api/tasks/${id}`),
  cancelTask: (id: string) => request<DurableTask>(`/api/tasks/${id}/cancel`, { method: 'POST' }),
  retryTask: (id: string) => request<DurableTask>(`/api/tasks/${id}/retry`, { method: 'POST' }),
  issues: () =>
    request<{ items: FileIssue[]; counts: Record<string, number>; totalReferences: number }>(
      '/api/assets/issues',
    ),
  relocateFile: (assetId: string, fileId: string) =>
    request<{ cancelled: boolean }>(`/api/assets/${assetId}/files/${fileId}/relocate`, {
      method: 'POST',
    }),
};

export const waitForTask = async (
  id: string,
  onUpdate?: (task: DurableTask) => void,
  signal?: AbortSignal,
) => {
  while (!signal?.aborted) {
    const task = await assetService.task(id);
    onUpdate?.(task);
    if (['completed', 'failed', 'cancelled', 'waiting_for_user'].includes(task.status)) return task;
    await new Promise((resolve) => window.setTimeout(resolve, 450));
  }
  throw new DOMException('任务轮询已取消', 'AbortError');
};
