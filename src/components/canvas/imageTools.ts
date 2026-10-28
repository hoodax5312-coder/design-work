import type { Node } from '@xyflow/react';
import { assetService } from '../../services/assetService';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { nodeRect } from './canvasModel';

export type PixelRect = { x: number; y: number; width: number; height: number };

const positiveInteger = (value: number) => Number.isSafeInteger(value) && value > 0;
const checkDimensions = (width: number, height: number) => {
  if (!positiveInteger(width) || !positiveInteger(height)) throw new Error('图片尺寸必须为正整数');
};
const checkImageSize = (width: number, height: number) => {
  checkDimensions(width, height);
  if (width * height > 32_000_000) throw new Error('图片不能超过 3200 万像素');
};
const originalUrl = (id: string) => `/api/assets/${encodeURIComponent(id)}/original`;

export const gridImageRects = (width: number, height: number, rows: number, columns: number): PixelRect[] => {
  checkDimensions(width, height);
  if (!positiveInteger(rows) || !positiveInteger(columns) || rows > 6 || columns > 6 || rows > height || columns > width) {
    throw new Error('行列必须为 1 到 6 的整数，且不能超过图片尺寸');
  }
  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = Math.floor(column * width / columns);
    const y = Math.floor(row * height / rows);
    return { x, y, width: Math.floor((column + 1) * width / columns) - x, height: Math.floor((row + 1) * height / rows) - y };
  });
};

export const cropImageRect = (width: number, height: number, rect: PixelRect): PixelRect => {
  checkDimensions(width, height);
  const { x, y, width: w, height: h } = rect;
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || !positiveInteger(w) || !positiveInteger(h)
    || w > width || h > height || x > width - w || y > height - h) {
    throw new Error('裁切区域必须是图片边界内的非空整数像素区域');
  }
  return { x, y, width: w, height: h };
};

export const loadToolImage = async (assetId: string): Promise<HTMLImageElement> => {
  if (!assetId.trim()) throw new Error('缺少原图资产 ID');
  const image = new Image();
  image.src = originalUrl(assetId);
  try {
    await image.decode();
  } catch {
    throw new Error('原图加载或解码失败');
  }
  checkImageSize(image.naturalWidth, image.naturalHeight);
  return image;
};

export const imageRegionFile = async (image: HTMLImageElement, rect: PixelRect, name: string): Promise<File> => {
  checkImageSize(image.naturalWidth, image.naturalHeight);
  const region = cropImageRect(image.naturalWidth, image.naturalHeight, rect);
  const canvas = document.createElement('canvas');
  canvas.width = region.width;
  canvas.height = region.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建图片处理画布');
  context.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result?.size ? resolve(result) : reject(new Error('PNG 导出失败：图片为空')), 'image/png');
  });
  if (blob.type !== 'image/png') throw new Error('PNG 导出失败：格式不正确');
  return new File([blob], `${name.replace(/\.[a-z0-9]+$/i, '') || '图片'}.png`, { type: 'image/png' });
};

const fileDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reader.onabort = () => reject(new Error('图片文件读取失败'));
  reader.onload = () => typeof reader.result === 'string' && reader.result.startsWith('data:image/png;base64,') && reader.result.length > 22
    ? resolve(reader.result) : reject(new Error('图片文件数据无效'));
  reader.readAsDataURL(file);
});

export const saveToolOutputs = async (
  sourceNodeId: string,
  sourceAssetId: string,
  outputs: { file: File; width: number; height: number; title: string }[],
  operation: 'crop' | 'split' | 'mask',
): Promise<void> => {
  const projectId = useCanvasStore.getState().projectId;
  const sourceNode = () => {
    const state = useCanvasStore.getState();
    const source = state.nodes.find((node) => node.id === sourceNodeId);
    if (!source || state.projectId !== projectId) throw new Error('源节点已删除或画布已切换，未添加输出节点');
    return source;
  };
  sourceNode();
  if (!sourceAssetId.trim() || !outputs.length || !['crop', 'split', 'mask'].includes(operation)) throw new Error('图片处理输出参数无效');
  for (const output of outputs) {
    checkImageSize(output.width, output.height);
    if (!output.file.size || output.file.type !== 'image/png') throw new Error('输出必须为非空 PNG 文件');
  }
  const saved: { id: string; output: typeof outputs[number] }[] = [];
  try {
    for (const output of outputs) {
      sourceNode();
      const sourceUrl = await fileDataUrl(output.file);
      sourceNode();
      const asset = await assetService.create({
        type: 'image', title: output.title, sourceUrl,
        userMetadata: { source: 'canvas', sourceAssetId, sourceNodeId, operation, width: output.width, height: output.height },
      });
      if (!asset.id) throw new Error('资产服务未返回资产 ID');
      saved.push({ id: asset.id, output });
    }
    // 所有异步工作完成后读取最新布局，一次加入节点；不创建原图参考连线。
    const source = nodeRect(sourceNode());
    const occupied = useCanvasStore.getState().nodes.map(nodeRect);
    const nodes: Node[] = saved.map(({ id, output }) => {
      const width = 320;
      const height = Math.max(1, Math.round(width * output.height / output.width));
      const rect = { x: source.x + source.width + 120, y: source.y, width, height };
      let collision: PixelRect | undefined;
      while ((collision = occupied.find((other) => rect.x < other.x + other.width + 24 && rect.x + width + 24 > other.x
        && rect.y < other.y + other.height + 24 && rect.y + height + 24 > other.y))) {
        rect.y = collision.y + collision.height + 24;
      }
      occupied.push(rect);
      return {
        id: crypto.randomUUID(), type: 'imageGen', position: { x: rect.x, y: rect.y }, width, height,
        data: { title: output.title, assetId: id, imageUrl: originalUrl(id), imageOriginalUrl: originalUrl(id),
          imageWidth: output.width, imageHeight: output.height, aspectRatio: '1:1', assetSaved: true },
      };
    });
    useCanvasStore.getState().addNodes(nodes);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`图片处理保存失败：${reason}。已入库 ${saved.length}/${outputs.length} 张；未完成画布输出，请检查资产库。`);
  }
};
