export type CaseMedia = {
  sourceId?: string;
  title?: string;
  imageModel?: string;
  sourceUrl?: string;
  coverUrl?: string | null;
  mediaType?: string;
};

export const isCaseVideo = (item: CaseMedia) => {
  if (item.mediaType?.toLowerCase() === 'video') return true;
  if (item.mediaType?.toLowerCase() === 'image') return false;
  const haystack = [item.imageModel, item.sourceId, item.title].filter(Boolean).join(' ').toLowerCase();
  if (haystack.includes('seedance') || haystack.includes('grok-imagine')) return true;
  return /\.(mp4|mov|webm|m3u8)(?:\?|$)/i.test(item.coverUrl || '')
    || /\.(mp4|mov|webm|m3u8)(?:\?|$)/i.test(item.sourceUrl || '');
};
