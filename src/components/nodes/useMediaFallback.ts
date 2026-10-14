import { useState } from 'react';
import { assetPreviewUrl } from '../canvas/canvasModel';

/**
 * 媒体地址失效（供应商临时链接过期、旧缓存）时回退到资产库预览；
 * 回退也失败时标记为失效，由节点显示如实的占位，而不是一张裂图。
 */
export const useMediaFallback = (url: string, assetId?: string) => {
  const [failedUrl, setFailedUrl] = useState('');
  const [deadUrl, setDeadUrl] = useState('');
  const fallback = assetId ? assetPreviewUrl(assetId) : '';
  const canFallback = Boolean(fallback) && fallback !== url;
  const usingFallback = Boolean(url) && failedUrl === url && canFallback;
  const dead = Boolean(url) && (deadUrl === url || (failedUrl === url && !canFallback));
  return {
    src: usingFallback ? fallback : url,
    dead,
    onError: () => (usingFallback ? setDeadUrl(url) : setFailedUrl(url)),
  };
};
