import { createContext, useContext } from 'react';
import type { XYPosition } from '@xyflow/react';

export interface PickerConnect {
  nodeId: string;
  /** source：从该节点向下游新建；target：为该节点新建上游。 */
  side: 'source' | 'target';
}

export interface CanvasActions {
  /** 在屏幕坐标处打开节点选择器；flowPosition 缺省时由屏幕坐标换算。 */
  openPicker: (screen: XYPosition, options?: { connect?: PickerConnect; flowPosition?: XYPosition }) => void;
  openMedia: (media: { kind: 'image' | 'video'; url: string; title: string }) => void;
  notify: (message: string, action?: { label: string; run: () => void }) => void;
}

const noop = () => undefined;

export const CanvasActionsContext = createContext<CanvasActions>({ openPicker: noop, openMedia: noop, notify: noop });

export const useCanvasActions = () => useContext(CanvasActionsContext);

/** 下载生成结果；跨域无法直接下载时在新标签页打开。 */
export const downloadMedia = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(String(response.status));
    const blobUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return true;
  } catch {
    window.open(url, '_blank', 'noopener');
    return false;
  }
};
