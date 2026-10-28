import type { Edge, Node } from '@xyflow/react';
import { activeResultOf, nodeRect, nodeTitle, readResults } from './canvasModel';
import { readReferenceImage, type CanvasReferenceImage } from './referenceImage';

export interface CanvasImageInput extends CanvasReferenceImage {
  sourceNodeId?: string;
  sourceResultId?: string;
}

/** 连线引用当前选中的结果，不用旧导入图冒充尚未入库的新结果。 */
export const imageInputFromNode = (node: Node): CanvasImageInput => {
  if (node.type !== 'imageGen') throw new Error('参考节点必须是图片');
  if (node.data.uploading || node.data.isGenerating) throw new Error('上游图片仍在上传或生成，请等待完成');
  const active = activeResultOf(node.data, 'imageUrl');
  const assetId = active?.assetId || (!readResults(node.data).length && typeof node.data.assetId === 'string' ? node.data.assetId : '');
  if (!assetId) throw new Error('上游当前图片尚未存入资产库，请先保存或重新导入');
  return { assetId, name: nodeTitle(node), sourceNodeId: node.id, ...(active ? { sourceResultId: active.id } : {}) };
};

export const resolveImageInput = (nodeId: string, data: Record<string, unknown>, nodes: Node[], edges: Edge[], maxReferences: number): CanvasImageInput | undefined => {
  const sourceIds = [...new Set(edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source))];
  const sources = sourceIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is Node => node?.type === 'imageGen');
  const manual = readReferenceImage(data.referenceImage);
  if (data.referenceImage != null && !manual) throw new Error('参考图资产引用无效，请重新选择');
  const count = sources.length + (manual ? 1 : 0);
  if (count && !maxReferences) throw new Error('当前模型尚不支持已实现的标准图生图协议；不会忽略参考图发起收费请求。请更换模型或移除图片参考');
  if (count > maxReferences) throw new Error(`当前模型最多支持 ${maxReferences} 张参考图，请断开多余图片连线或移除手动参考，不会自动丢弃参考图`);
  return manual || (sources[0] ? imageInputFromNode(sources[0]) : undefined);
};

/** 只派生空白输出，不继承结果、错误、运行状态或源提示词。 */
export const derivedImageNode = (source: Node, nodes: Node[]): { node: Node; edge: Edge } => {
  imageInputFromNode(source);
  const rect = nodeRect(source);
  const position = { x: rect.x + rect.width + 120, y: rect.y };
  while (nodes.some((node) => {
    const other = nodeRect(node);
    return position.x < other.x + other.width + 24 && position.x + 320 + 24 > other.x
      && position.y < other.y + other.height + 24 && position.y + 320 + 24 > other.y;
  })) position.y += 368;
  const id = crypto.randomUUID();
  const data = source.data;
  return {
    node: { id, type: 'imageGen', position, width: 320, data: {
      title: '继续改图', prompt: '', count: 1,
      ...Object.fromEntries(['providerId', 'model', 'aspectRatio', 'quality'].filter((key) => data[key] != null).map((key) => [key, data[key]])),
    } },
    edge: { id: crypto.randomUUID(), source: source.id, target: id, type: 'flow' },
  };
};
