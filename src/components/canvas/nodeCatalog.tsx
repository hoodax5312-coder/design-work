import type { ElementType } from 'react';
import type { Node, XYPosition } from '@xyflow/react';
import { Artboard, Film, ImagePlus, Music, StickyNote, Type } from '@/lib/remixIconShim';
import {
  ANNOTATION_LABEL,
  ANNOTATION_SIZE,
  DEFAULT_NODE_SIZE,
  GROUP_Z_INDEX,
  NODE_KIND_LABEL,
  annotationData,
  defaultNodeData,
  type CanvasAnnotationKind,
  type CanvasNodeKind,
} from './canvasModel';

export interface NodeKindMeta {
  kind: CanvasNodeKind;
  label: string;
  /** 选择器里的一句用途说明。 */
  hint: string;
  icon: ElementType;
  shortcut: string;
}

export const NODE_CATALOG: Record<CanvasNodeKind, NodeKindMeta> = {
  text: { kind: 'text', label: NODE_KIND_LABEL.text, hint: '脚本、广告词、提示词草稿', icon: Type, shortcut: 'T' },
  imageGen: { kind: 'imageGen', label: NODE_KIND_LABEL.imageGen, hint: '海报、分镜、角色与场景', icon: ImagePlus, shortcut: 'I' },
  video: { kind: 'video', label: NODE_KIND_LABEL.video, hint: '镜头、动态海报与短片', icon: Film, shortcut: 'M' },
  audio: { kind: 'audio', label: NODE_KIND_LABEL.audio, hint: 'AI 生成配乐，或上传本地音频', icon: Music, shortcut: 'A' },
};

export const NODE_CATALOG_LIST = Object.values(NODE_CATALOG);

export interface AnnotationKindMeta {
  kind: CanvasAnnotationKind;
  label: string;
  hint: string;
  icon: ElementType;
  /** 单键新建；分组没有单键，用 ⌘G 把所选节点编组。 */
  shortcut?: string;
}

export const ANNOTATION_CATALOG: Record<CanvasAnnotationKind, AnnotationKindMeta> = {
  note: { kind: 'note', label: ANNOTATION_LABEL.note, hint: '批注、待办与灵感，不参与生成', icon: StickyNote, shortcut: 'N' },
  group: { kind: 'group', label: ANNOTATION_LABEL.group, hint: '画框收纳节点，拖动时整组移动', icon: Artboard },
};

export const ANNOTATION_CATALOG_LIST = Object.values(ANNOTATION_CATALOG);

/** 新节点。position 为节点左上角；centered 为 true 时以该点为中心放置。 */
export const makeCanvasNode = (
  kind: CanvasNodeKind,
  position: XYPosition,
  data: Record<string, unknown> = {},
  options: { centered?: boolean } = {},
): Node => {
  const size = DEFAULT_NODE_SIZE[kind];
  const ratio = String(data.aspectRatio || defaultNodeData(kind).aspectRatio || '1:1').split(':').map(Number);
  const estimatedHeight = size.height ?? Math.round(size.width * ((ratio[1] || 1) / (ratio[0] || 1)));
  const origin = options.centered ? { x: position.x - size.width / 2, y: position.y - estimatedHeight / 2 } : position;
  return {
    id: crypto.randomUUID(),
    type: kind,
    position: { x: Math.round(origin.x), y: Math.round(origin.y) },
    width: size.width,
    ...(size.height ? { height: size.height } : {}),
    data: { ...defaultNodeData(kind), ...data },
  };
};

/** 新便签或空分组框，默认以该点为中心放置。分组始终压在其他节点下面。 */
export const makeAnnotationNode = (kind: CanvasAnnotationKind, center: XYPosition, data: Record<string, unknown> = {}): Node => {
  const size = ANNOTATION_SIZE[kind];
  return {
    id: crypto.randomUUID(),
    type: kind,
    position: { x: Math.round(center.x - size.width / 2), y: Math.round(center.y - size.height / 2) },
    width: size.width,
    height: size.height,
    ...(kind === 'group' ? { zIndex: GROUP_Z_INDEX } : {}),
    data: { ...annotationData(kind), ...data },
  };
};
