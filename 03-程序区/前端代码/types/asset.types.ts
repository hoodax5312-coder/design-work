export type AssetType = 'image' | 'video' | 'ppt' | 'knowledge' | 'file' | string;

export interface AssetSummary {
  id: string;
  type: AssetType;
  title: string;
  description: string;
  primaryFolderId: string | null;
  favorite: boolean;
  rating: number;
  status: string;
  normalizedMetadata: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
  createdAt: number;
  importedAt: number;
  updatedAt: number;
  previewUrl: string;
  previewStatus: string;
}

export interface FileReference {
  id: string;
  absolutePath: string;
  volumeId: string | null;
  fileName: string;
  extension: string;
  mimeType: string | null;
  fileSize: number;
  fileCreatedAt: number | null;
  fileModifiedAt: number | null;
  status: string;
  lastAccessibleAt: number | null;
}

export interface AssetTag {
  id: string;
  name: string;
  color: string | null;
  groupName: string | null;
  assetCount?: number;
}

export interface AssetDetail extends AssetSummary {
  sourceUrl: string | null;
  author: string | null;
  licenseNote: string | null;
  tags: AssetTag[];
  files: FileReference[];
  previews: Array<Record<string, unknown>>;
}

export interface AssetFolder {
  id: string;
  parentId: string | null;
  name: string;
  assetCount: number;
}

export interface AssetPage {
  items: AssetSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface DurableTask {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'waiting_for_user' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string | null;
  output: unknown;
  error: { message?: string } | null;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ImportItem {
  id: string;
  absolutePath: string;
  fileName: string;
  extension: string;
  fileSize: number;
  duplicateAssetId: string | null;
  duplicateItemId: string | null;
  suggestedType: string;
  decision: 'import_new' | 'merge_path' | 'keep_separate' | 'skip' | null;
  userOverrides: Record<string, unknown>;
}

export interface ImportSession {
  id: string;
  status: string;
  summary: { files?: number; conflicts?: number; issues?: unknown[] };
  items: ImportItem[];
}

export interface FileIssue extends FileReference {
  assetId: string;
  assetTitle: string;
  assetType: string;
}
