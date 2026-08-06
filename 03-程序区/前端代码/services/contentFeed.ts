export interface GeneratedContentItem {
  id: string;
  type: 'image' | 'video' | 'ppt';
  title: string;
  description: string;
  previewUrl: string;
  createdAt: number;
  savedToAssets: boolean;
  metadata: Record<string, unknown>;
}

const KEY = 'design-work-content-feed';

export const contentFeed = {
  list(): GeneratedContentItem[] {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]') as GeneratedContentItem[];
    } catch {
      return [];
    }
  },
  add(item: Omit<GeneratedContentItem, 'id' | 'createdAt' | 'savedToAssets'>) {
    const next: GeneratedContentItem = {
      ...item,
      id: `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      savedToAssets: false,
    };
    localStorage.setItem(KEY, JSON.stringify([next, ...contentFeed.list()].slice(0, 100)));
    window.dispatchEvent(new Event('design-work:content-feed-updated'));
    return next;
  },
  markSaved(id: string) {
    const next = contentFeed.list().map((item) => item.id === id ? { ...item, savedToAssets: true } : item);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('design-work:content-feed-updated'));
  },
};
