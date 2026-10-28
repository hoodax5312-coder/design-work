import { assertImageEditSupported } from './imageEditSupport';
import type { ProviderProtocol } from '../types/provider';

const RATIOS = ['1:1', '16:9', '9:16'] as const;
const GPT_QUALITIES = [
  { value: 'medium', label: '标准' },
  { value: 'high', label: '高清' },
  { value: 'low', label: '低' },
  { value: 'auto', label: '自动' },
] as const;
const GENERIC_QUALITIES = [
  { value: 'standard', label: '标准' },
  { value: 'hd', label: '高清' },
] as const;

// Reuse the exact edits allowlist; model names and aliases never imply reference support.
const supportsGptEdits = (protocol: ProviderProtocol, model: string) => {
  try {
    assertImageEditSupported(protocol, model);
    return true;
  } catch {
    return false;
  }
};

export const canvasImageCapability = (protocol: ProviderProtocol, model: string): {
  ratios: readonly string[];
  qualities: readonly { value: string; label: string }[];
  maxReferences: number;
} => {
  if (protocol !== 'responses' && protocol !== 'chat-completions') {
    throw new Error(`当前 ${protocol} 不支持已实现的画布图片生成协议`);
  }
  const gpt = supportsGptEdits(protocol, model);
  return { ratios: RATIOS, qualities: gpt ? GPT_QUALITIES : GENERIC_QUALITIES, maxReferences: gpt ? 1 : 0 };
};

export const defaultCanvasImageParameters = (protocol: ProviderProtocol, model: string): {
  aspectRatio: string;
  quality: string;
} => {
  const capability = canvasImageCapability(protocol, model);
  return { aspectRatio: capability.ratios[0], quality: capability.qualities[0].value };
};

export const resolveCanvasImageParameters = (
  protocol: ProviderProtocol,
  model: string,
  data: { aspectRatio?: unknown; quality?: unknown },
): { aspectRatio: string; quality: string; size: string } => {
  const capability = canvasImageCapability(protocol, model);
  const defaults = defaultCanvasImageParameters(protocol, model);
  const aspectRatio = data.aspectRatio === undefined ? defaults.aspectRatio : data.aspectRatio;
  let quality = data.quality === undefined ? defaults.quality : data.quality;
  // Old canvas projects stored standard/hd. Normalize only for the known GPT models.
  if (capability.maxReferences === 1) {
    if (quality === 'standard') quality = 'medium';
    if (quality === 'hd') quality = 'high';
  }
  if (typeof aspectRatio !== 'string' || !capability.ratios.includes(aspectRatio)) {
    throw new Error('画布图片 aspectRatio 无效，请重新选择支持的比例');
  }
  if (typeof quality !== 'string' || !capability.qualities.some((option) => option.value === quality)) {
    throw new Error('画布图片 quality 无效，请重新选择支持的质量');
  }
  // These are gateway transport sizes, not a promise of exact 16:9/9:16 output.
  const landscape = model === 'dall-e-3' ? '1792x1024' : '1536x1024';
  const portrait = model === 'dall-e-3' ? '1024x1792' : '1024x1536';
  const size = aspectRatio === '16:9' ? landscape : aspectRatio === '9:16' ? portrait : '1024x1024';
  return { aspectRatio, quality, size };
};
