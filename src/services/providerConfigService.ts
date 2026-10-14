import type {
  ActiveProviderIds,
  ModelCategory,
  ProviderConfig,
  ProviderStateSnapshot,
} from '../types/provider';

export type ProviderImportMode = 'replace-matching' | 'add-missing';

export interface ProviderConfigExport extends ProviderStateSnapshot {
  format: 'design-work-provider-config';
  version: number;
  exportedAt: string;
}

const GATEWAY_UNREACHABLE =
  '无法连接本机网关，API 配置暂时无法读取或保存。请确认栗作已启动（npm run dev 或 npm start）后重试';

const request = async <T>(path: string, method: string, body?: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`/api/provider/config${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new Error(GATEWAY_UNREACHABLE);
  }
  const payload = await response.json().catch(() => undefined) as { error?: string } | undefined;
  if (!response.ok) {
    // 开发服务器在网关不可用时可能返回 HTML 或空响应，这时同样按网关不可用提示。
    throw new Error(payload?.error || (response.status >= 500 ? GATEWAY_UNREACHABLE : `API 配置操作失败 (${response.status})`));
  }
  if (!payload) throw new Error(`本机网关返回的 API 配置格式不正确 (${response.status})`);
  return payload as T;
};

export const providerConfigService = {
  read: () => request<ProviderStateSnapshot>('', 'GET'),
  saveProvider: (provider: ProviderConfig) =>
    request<ProviderStateSnapshot>(`/providers/${encodeURIComponent(provider.id)}`, 'PUT', { provider }),
  removeProvider: (id: string) =>
    request<ProviderStateSnapshot>(`/providers/${encodeURIComponent(id)}`, 'DELETE'),
  setActiveProvider: (category: ModelCategory, providerId: string | null) =>
    request<ProviderStateSnapshot>('/active', 'PUT', { category, providerId }),
  setSelectedModel: (providerId: string, category: ModelCategory, modelId: string) =>
    request<ProviderStateSnapshot>('/selected-model', 'PUT', { providerId, category, modelId }),
  importProviders: (
    snapshot: { providers: ProviderConfig[]; activeProviderIds: ActiveProviderIds },
    mode: ProviderImportMode,
  ) => request<ProviderStateSnapshot>('/import', 'POST', { ...snapshot, mode }),
  /** 导出文件包含完整的 API Key。 */
  exportProviders: () => request<ProviderConfigExport>('/export', 'POST'),
};
