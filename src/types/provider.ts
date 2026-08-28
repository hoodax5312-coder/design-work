export type ProviderProtocol = 'responses' | 'chat-completions' | 'anthropic-messages';
export type ModelCategory = 'language' | 'image' | 'video';
export type VerificationStatus = 'pending' | 'healthy' | 'unhealthy' | 'unverified';

export interface ProviderVerification {
  status: VerificationStatus;
  checkedAt?: number;
  latency?: number;
  error?: string;
}

export interface ProviderModel {
  id: string;
  categories: ModelCategory[];
  baseUrlOverride?: string;
  apiKeyOverride?: string;
  verification?: ProviderVerification;
}

export interface ProviderConfig {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  apiKey: string;
  models: ProviderModel[];
  selectedModels: Partial<Record<ModelCategory, string>>;
  savedAt?: number;
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
}
