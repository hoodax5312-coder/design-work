import { assetService } from '../../services/assetService';
import type { ProviderConfig } from '../../types/provider';
import { assertImageEditSupported } from '../../lib/imageEditSupport';

export interface CanvasReferenceImage {
  assetId: string;
  name: string;
}

export const readReferenceImage = (value: unknown): CanvasReferenceImage | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const image = value as Partial<CanvasReferenceImage>;
  return typeof image.assetId === 'string' && image.assetId && typeof image.name === 'string'
    ? { assetId: image.assetId, name: image.name }
    : undefined;
};

export const referenceImageUrl = (image: CanvasReferenceImage) =>
  `/api/assets/${encodeURIComponent(image.assetId)}/preview?size=512`;

export const saveReferenceImage = async (file: File): Promise<CanvasReferenceImage> => {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('参考图仅支持 PNG、JPEG 或 WebP 图片');
  }
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('请选择不超过 10 MB 的非空参考图');
  const sourceUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取参考图失败，请重新选择'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('读取参考图失败，请重新选择'));
    reader.readAsDataURL(file);
  });
  // 资产接口会校验图片并将原文件写入本机；节点只保存资产引用，不保存 base64/blob URL。
  const asset = await assetService.create({
    type: 'image', title: file.name, sourceUrl,
    userMetadata: { source: 'local-upload', purpose: 'canvas-reference' },
  });
  if (!asset.id) throw new Error('参考图入库失败：没有返回资产 ID');
  return { assetId: asset.id, name: file.name };
};

/** 只按当前画布网关的实际实现判断，不从模型名称猜测参考图能力。 */
export const assertReferenceImageSupported = (
  kind: 'imageGen' | 'video', provider: Pick<ProviderConfig, 'protocol'>, model = '',
) => {
  if (kind === 'imageGen') return assertImageEditSupported(provider.protocol, model);
  throw new Error(`当前 ${provider.protocol} 协议的画布网关仅实现 /video/generations，尚不支持图生视频参考图。请移除参考图后使用文本生成；不会忽略参考图发起收费请求。`);
};
