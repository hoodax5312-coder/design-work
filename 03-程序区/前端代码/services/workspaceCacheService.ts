const request = async <T>(key: 'generation-history' | 'canvas-workspace', init?: RequestInit): Promise<T | null> => {
  const response = await fetch(`/api/storage/workspace/${key}`, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error((payload as { error?: string } | null)?.error || `缓存操作失败 (${response.status})`);
  return payload as T | null;
};

export const workspaceCacheService = {
  read: <T>(key: 'generation-history' | 'canvas-workspace') => request<T>(key),
  write: (key: 'generation-history' | 'canvas-workspace', value: unknown) =>
    request<{ ok: true }>(key, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    }),
};
