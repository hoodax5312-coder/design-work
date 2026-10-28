const request = async <T>(key: 'generation-history' | 'canvas-workspace', init?: RequestInit): Promise<T | null> => {
  const response = await fetch(`/api/storage/workspace/${key}`, init).catch(() => {
    throw new Error('无法连接本机网关，请恢复服务后重试保存；请勿清理浏览器数据');
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error((payload as { error?: string } | null)?.error || `缓存操作失败 (${response.status})`);
  return payload as T | null;
};

const RECOVERY_KEY = 'design-work-canvas-workspace-recovery';
let canvasWriteQueue: Promise<unknown> = Promise.resolve();

export const workspaceCacheService = {
  read: async <T>(key: 'generation-history' | 'canvas-workspace'): Promise<T | null> => {
    if (key === 'canvas-workspace') {
      const recovery = localStorage.getItem(RECOVERY_KEY);
      if (recovery) return JSON.parse(recovery) as T;
    }
    return request<T>(key);
  },
  write: async (key: 'generation-history' | 'canvas-workspace', value: unknown) => {
    const body = JSON.stringify(value);
    const send = () => request<{ ok: true }>(key, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (key !== 'canvas-workspace') return send();
    // 同步落下恢复副本，关闭页面时不依赖尚未完成的网络请求。
    localStorage.setItem(RECOVERY_KEY, body);
    const pending = canvasWriteQueue.catch(() => undefined).then(send).then((result) => {
      if (localStorage.getItem(RECOVERY_KEY) === body) localStorage.removeItem(RECOVERY_KEY);
      return result;
    });
    canvasWriteQueue = pending;
    return pending;
  },
};
