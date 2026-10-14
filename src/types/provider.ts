export type ProviderProtocol = 'responses' | 'chat-completions' | 'anthropic-messages';
export type ModelCategory = 'language' | 'image' | 'video';
export type VerificationStatus = 'pending' | 'healthy' | 'unhealthy' | 'unverified';

export interface ProviderVerification {
  status: VerificationStatus;
  checkedAt?: number;
  latency?: number;
  error?: string;
}

/**
 * 网关已保存的 Key 在浏览器里只给掩码。origins 是这把 Key 允许发往的地址（协议 + 域名 + 端口），
 * Base URL 换到别的地址时必须重新填写 Key。
 */
export interface StoredKeyHint {
  masked: string;
  origins: string[];
}

/** 请求里没有带 Key 时，让网关按这个引用取出已保存的 Key。 */
export interface StoredKeyRef {
  providerId: string;
  modelId?: string;
  scope: 'provider' | 'model';
}

export interface ProviderModel {
  id: string;
  categories: ModelCategory[];
  baseUrlOverride?: string;
  apiKeyOverride?: string;
  /** 只在网关返回的配置里出现；保存时带上表示沿用已保存的模型 Key。 */
  apiKeyOverrideHint?: StoredKeyHint;
  verification?: ProviderVerification;
}

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  /** 只在网关返回的配置里出现；apiKey 留空保存时沿用已保存的 Key。 */
  apiKeyHint?: StoredKeyHint;
  models: ProviderModel[];
  selectedModels: Partial<Record<ModelCategory, string>>;
  savedAt?: number;
}

/** 上游模型列表中的一项；名称和上下文长度只在上游返回时才有。 */
export interface ProviderModelInfo {
  id: string;
  name?: string;
  contextLength?: number;
}

export type ActiveProviderIds = Partial<Record<ModelCategory, string>>;

export interface ProviderStateSnapshot {
  providers: ProviderConfig[];
  activeProviderIds: ActiveProviderIds;
}

export interface ResolvedProviderConnection {
  category: ModelCategory;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** apiKey 为空时，由网关按这个引用填入已保存的 Key。 */
  storedKey?: StoredKeyRef;
}
