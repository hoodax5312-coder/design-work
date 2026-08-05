import type {
  HiggsfieldAssetItem,
  HiggsfieldFolder,
  HiggsfieldProject,
  PageResponse,
} from '../types/higgsfield.types';

const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || '数据读取失败');
  return payload as T;
};

export interface HiggsfieldAuditProject {
  publicationId: string;
  name: string;
  slug: string;
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

export interface HiggsfieldAudit {
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
  projects: HiggsfieldAuditProject[];
  reportPath: string | null;
  error: string | null;
}

export const higgsfieldService = {
  listProjects: (category = '') =>
    request<PageResponse<HiggsfieldProject>>(
      `/api/higgsfield/projects${category ? `?category=${encodeURIComponent(category)}` : ''}`,
    ),
  listFolders: (folderId: string) =>
    request<PageResponse<HiggsfieldFolder>>(`/api/higgsfield/folders/${folderId}/children`),
  listAssets: (folderId: string, cursor?: string | number | null) =>
    request<PageResponse<HiggsfieldAssetItem>>(
      `/api/higgsfield/folders/${folderId}/items?size=60${cursor ? `&cursor=${encodeURIComponent(String(cursor))}` : ''}`,
    ),
  syncProject: (folderId: string) =>
    request<{ ok: boolean; path: string; folders: number; assets: number }>(
      `/api/higgsfield/sync/${folderId}`,
      { method: 'POST' },
    ),
  getAudit: () => request<HiggsfieldAudit>('/api/higgsfield/audit'),
  startAudit: () => request<HiggsfieldAudit>('/api/higgsfield/audit/start', { method: 'POST' }),
  cancelAudit: () => request<{ ok: boolean }>('/api/higgsfield/audit/cancel', { method: 'POST' }),
};

export const fallbackProjects: HiggsfieldProject[] = [
  {
    publication_id: '9edf6917-846f-480b-8316-99aa993f2847',
    name: '4K Blockbuster Breakdown',
    slug: '4k-blockbuster-breakdown',
    description: '一个普通人被困在妹妹生成的 AI 世界中，穿越海盗船、沙漠、丛林和公寓。',
    snapshot_folder_id: '5b85ca9a-a5cb-4d99-87c9-bedbf0abbe95',
    cover: {
      type: 'media',
      url: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3CRGV60QtXkARI1qsjfrcLQIV4l/4359cdad-12b6-4f58-bc1a-71c7985ec35d.jpg',
    },
    authors: [{ id: 'adil', full_name: 'Adil Alimzhanov', username: 'adilinthewild' }],
    tags: ['cinematic short film', 'action film'],
    views: 23879,
    likes: 171,
  },
  {
    publication_id: 'academy',
    name: 'Higgsfield Academy',
    slug: 'higgsfield-academy',
    description: '从概念、角色资产到成片的完整生成式制片工程。',
    snapshot_folder_id: 'fb8277a2-51da-48d5-912a-cc561dd3fc39',
    cover: { type: 'media', url: 'https://static.higgsfield.ai/cinema-studio/kok-boru-poster.webp' },
    authors: [{ id: 'launch', full_name: 'Higgsfield Launch', username: 'higgsfield' }],
    tags: ['academy', 'workflow'],
    views: 2544,
    likes: 19,
  },
  {
    publication_id: 'top-up',
    name: '"Top Up" Cinematic AD',
    slug: 'top-up',
    description: '超级英雄式电影广告，包含城市空镜、角色资产与动作镜头迭代。',
    snapshot_folder_id: '2fe23083-8d0f-47fb-bbcb-eac1f2cf9cfa',
    cover: {
      type: 'media',
      url: 'https://d2ol7oe51mr4n9.cloudfront.net/user_3CRGV60QtXkARI1qsjfrcLQIV4l/4359cdad-12b6-4f58-bc1a-71c7985ec35d.jpg',
    },
    authors: [{ id: 'adil', full_name: 'Adil Alimzhanov', username: 'adilinthewild' }],
    tags: ['commercial', 'cinematic'],
    views: 7738,
    likes: 43,
  },
  {
    publication_id: 'huntress',
    name: "Huntress's Tale",
    slug: 'huntress-s-tale',
    description: '奇幻叙事短片，用统一角色和场景资产构建连续的电影镜头。',
    snapshot_folder_id: '95a3e934-769b-474c-aa74-7a28bf4f726a',
    cover: { type: 'media', url: 'https://static.higgsfield.ai/cinema-studio/kok-boru-poster.webp' },
    authors: [{ id: 'ailaa', full_name: 'Higgsfield Soul', username: 'ailaa' }],
    tags: ['fantasy', 'character'],
    views: 42619,
    likes: 209,
  },
];

export const fallbackFolders: HiggsfieldFolder[] = [
  { id: '7b08fc37-6a07-431d-93d9-afce029b11e8', name: 'SCENE 1 · 海盗船', count: 740, color: 'lime' },
  { id: 'cdc7f7f3-bb9e-4d8a-a6fa-c6959c4cdac0', name: 'SCENE 2 · 沙漠', count: 431, color: 'amber' },
  { id: '5f17b189-db0c-40c4-920d-a925fb0f60e4', name: 'SCENE 3 · 丛林', count: 3763, color: 'emerald' },
  { id: '5340fba6-cdb4-4cbf-a6d5-2340fe0f85e0', name: 'SCENE 4 · 房间', count: 364, color: 'cyan' },
];
