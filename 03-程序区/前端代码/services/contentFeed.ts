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

// Large provider responses (notably Wan2.1 b64_json videos) can exceed the
// browser's localStorage quota. Keep those entries in the current session
// instead of dropping the completed generation or surfacing a quota error.
let volatileItems: GeneratedContentItem[] = [];

const persistedItems = (): GeneratedContentItem[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as GeneratedContentItem[];
  } catch {
    return [];
  }
};

export const contentFeed = {
  list(): GeneratedContentItem[] {
    return [...volatileItems, ...persistedItems()];
  },
  add(item: Omit<GeneratedContentItem, 'id' | 'createdAt' | 'savedToAssets'>) {
    const next: GeneratedContentItem = {
      ...item,
      id: `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      savedToAssets: false,
    };
    const existing = contentFeed.list().filter((item) => !volatileItems.some((volatileItem) => volatileItem.id === item.id));
    try {
      localStorage.setItem(KEY, JSON.stringify([next, ...existing].slice(0, 100)));
    } catch {
      volatileItems = [next, ...volatileItems].slice(0, 20);
    }
    window.dispatchEvent(new Event('design-work:content-feed-updated'));
    return next;
  },
  markSaved(id: string) {
    volatileItems = volatileItems.map((item) => item.id === id ? { ...item, savedToAssets: true } : item);
    const next = persistedItems().map((item) => item.id === id ? { ...item, savedToAssets: true } : item);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // The volatile result remains available in this session.
    }
    window.dispatchEvent(new Event('design-work:content-feed-updated'));
  },
};
