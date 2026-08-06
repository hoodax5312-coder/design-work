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
  tagId?: string;
  favorite?: boolean;
  status?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}

export const assetService = {
  create: (input: {
    type: string;
    title: string;
    description?: string;
    primaryFolderId?: string | null;
    userMetadata?: Record<string, unknown>;
  }) => request<AssetSummary>('/api/assets', json(input)),
  list: async (query: AssetQuery = {}) => {
    const parameters = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') parameters.set(key, String(value));
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
  folders: async () => {
    const result = await request<{ items?: AssetFolder[] }>('/api/assets/folders');
    return Array.isArray(result.items) ? result.items : [];
  },
  createFolder: (name: string) => request<AssetFolder>('/api/assets/folders', json({ name })),
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
      throw new Error((payload as { error?: string }).error || `图片入库失败 (${response.status})`);
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
