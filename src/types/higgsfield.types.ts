export interface HiggsfieldMedia {
  id?: string;
  url: string;
  type: 'video' | 'image' | 'media' | string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  thumbnail_url?: string | null;
}

export interface HiggsfieldAuthor {
  id: string;
  full_name: string;
  username: string;
  avatar_url?: string | null;
}

export interface HiggsfieldProject {
  publication_id: string;
  name: string;
  slug: string;
  description?: string;
  snapshot_folder_id: string;
  cover?: HiggsfieldMedia | null;
  gallery_media?: HiggsfieldMedia[];
  authors?: HiggsfieldAuthor[];
  tags?: string[];
  categories?: string[];
  views?: number;
  likes?: number;
  created_at?: string;
}

export interface HiggsfieldFolder {
  id: string;
  parent_id?: string | null;
  name: string;
  color?: string;
  count: number;
  subfolders_count?: number;
  preview_url?: string | null;
}

export interface GenerationParams {
  prompt?: string;
  negative_prompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  quality?: string;
  duration?: number;
  aspect_ratio?: string;
  fps?: number;
  enhance_prompt?: boolean;
  style?: {
    id?: string;
    name?: string;
    strength?: number;
    url?: string;
  };
  [key: string]: unknown;
}

export interface HiggsfieldJob {
  id: string;
  status: string;
  result?: HiggsfieldMedia;
  results?: {
    raw?: HiggsfieldMedia;
    min?: HiggsfieldMedia;
  };
  params?: GenerationParams;
  job_set_type?: string;
  created_at?: number;
  folder_id?: string;
  comments_count?: number;
}

export interface HiggsfieldAssetItem {
  type: string;
  job?: HiggsfieldJob;
}

export interface PageResponse<T> {
  items: T[];
  cursor?: string | number | null;
  next_cursor?: string | number | null;
}
