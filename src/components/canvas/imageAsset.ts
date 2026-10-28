import { assetService } from '../../services/assetService';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { readResults } from './canvasModel';

export const imageOriginalUrl = (assetId: string) => `/api/assets/${encodeURIComponent(assetId)}/original`;

export const imageAspectRatio = (width: unknown, height: unknown, fallback: string) =>
  typeof width === 'number' && typeof height === 'number' && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? `${width} / ${height}` : fallback;

export const saveCanvasImage = async (file: File) => {
  if (!file.type.startsWith('image/') || !file.size) throw new Error('请选择非空图片文件');
  if (file.size > 50 * 1024 * 1024) throw new Error('图片不能超过 50 MB');
  const sourceUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
  const asset = await assetService.create({
    type: 'image', title: file.name, sourceUrl,
    userMetadata: { source: 'local-upload', purpose: 'canvas-image' },
  });
  if (!asset.id) throw new Error('图片入库失败：没有返回资产 ID');
  return asset;
};

export const uploadImageToNode = async (nodeId: string, file: File) => {
  try {
    const asset = await saveCanvasImage(file);
    const { nodes, updateNode } = useCanvasStore.getState();
    // 上传完成前节点可能已被删除，不重建节点或污染其他节点。
    if (!nodes.some((node) => node.id === nodeId)) return true;
    updateNode(nodeId, { imageUrl: imageOriginalUrl(asset.id), assetId: asset.id, uploading: false, assetSaved: true, error: undefined });
    return true;
  } catch (error) {
    useCanvasStore.getState().updateNode(nodeId, { uploading: false, error: error instanceof Error ? error.message : '图片入库失败' });
    return false;
  }
};

/** 只记录仍在展示的原图尺寸，避免旧图片的延迟 load 覆盖新结果。 */
export const recordImageDimensions = (nodeId: string, url: string, width: number, height: number) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
  const { nodes, updateNode } = useCanvasStore.getState();
  const data = nodes.find((node) => node.id === nodeId)?.data;
  if (!data || data.imageUrl !== url) return;
  const results = readResults(data);
  const active = results.find((result) => result.id === data.activeResultId);
  if (active) {
    if (active.width === width && active.height === height) return;
    updateNode(nodeId, { results: results.map((result) => result.id === active.id ? { ...result, width, height } : result) });
  } else if (data.imageWidth !== width || data.imageHeight !== height) {
    updateNode(nodeId, { imageWidth: width, imageHeight: height });
  }
};

/** 下载原图，按响应 MIME 命名；失败不退回缩略图冒充原图。 */
export const downloadOriginalImage = async (assetId: string | undefined, sourceUrl: string, title: string) => {
  const url = assetId ? `${imageOriginalUrl(assetId)}?download=1` : sourceUrl;
  if (!url || (!assetId && /\/api\/assets\/.*\/preview/.test(url))) throw new Error('此历史结果没有原图引用，无法下载原图');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`原图下载失败 (${response.status})`);
  const blob = await response.blob();
  const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/heif': 'heif', 'image/tiff': 'tiff', 'image/svg+xml': 'svg' } as Record<string, string>)[blob.type.split(';')[0]];
  if (!extension || !blob.size) throw new Error('原图格式无效，未下载');
  const blobUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `${title.replace(/\.[a-z0-9]+$/i, '').replace(/[\\/:*?"<>|]/g, '_') || '图片'}.${extension}`;
    anchor.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
};
