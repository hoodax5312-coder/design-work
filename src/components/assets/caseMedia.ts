export type CaseMedia = {
  sourceId?: string;
  title?: string;
  imageModel?: string;
  sourceUrl?: string;
  coverUrl?: string | null;
  mediaType?: string;
  videoUrl?: string | null;
};

export const isCaseVideo = (item: CaseMedia) => {
  if (item.mediaType?.toLowerCase() === 'video') return true;
  if (item.mediaType?.toLowerCase() === 'image') return false;
  if (/\.(mp4|mov|webm|m3u8)(?:\?|$)/i.test(item.videoUrl || '')) return true;
  const haystack = [item.imageModel, item.sourceId, item.title].filter(Boolean).join(' ').toLowerCase();
  if (haystack.includes('seedance') || haystack.includes('grok-imagine')) return true;
  return /\.(mp4|mov|webm|m3u8)(?:\?|$)/i.test(item.coverUrl || '')
    || /\.(mp4|mov|webm|m3u8)(?:\?|$)/i.test(item.sourceUrl || '');
};

// 视频类别不代表封面地址就是可播放的视频文件。
export const getCaseVideoUrl = (item: CaseMedia) => {
  const url = item.videoUrl || item.coverUrl || '';
  return isCaseVideo(item) && /\.(mp4|mov|webm)(?:\?|$)/i.test(url) ? url : null;
};

export const getCasePlaybackUrl = (item: CaseMedia) => {
  const direct = getCaseVideoUrl(item);
  if (direct) return direct;
  if (!isCaseVideo(item)) return null;
  for (const value of [item.videoUrl, item.coverUrl, item.sourceUrl]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
      if (/\.(m3u8|mp4|mov|webm)$/i.test(url.pathname)) return url.href;
      // Cloudflare Stream posters and HLS manifests share the same video ID.
      if (/^customer-[a-z0-9]+\.cloudflarestream\.com$/.test(url.hostname)
        && /^\/[a-f0-9]{32}\/thumbnails\/thumbnail\.jpg$/.test(url.pathname)
        && !url.search) {
        return `${url.origin}/${url.pathname.split('/')[1]}/manifest/video.m3u8`;
      }
    } catch { /* Ignore malformed upstream media URLs. */ }
  }
  return null;
};
