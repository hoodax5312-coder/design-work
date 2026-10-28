import { assetService } from '../../services/assetService';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { audioMediaUrl } from './canvasModel';

export const AUDIO_ACCEPT = '.mp3,.wav,.m4a,.aac,.flac,.ogg,audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/flac,audio/ogg';

export const isAudioFile = (file: File) => file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(file.name);

/**
 * 把本地音频上传到资产库并写入节点。节点只保存资产 ID 与本机原文件地址，
 * 不保存 blob URL；失败时保留节点原有音频并写入真实错误。
 */
export const uploadAudioToNode = async (nodeId: string, file: File) => {
  const { updateNode } = useCanvasStore.getState();
  updateNode(nodeId, { uploading: true, error: undefined, notice: undefined });
  try {
    if (!isAudioFile(file)) throw new Error('仅支持 MP3、WAV、M4A、AAC、FLAC 或 OGG 音频');
    const asset = await assetService.uploadAudio(file);
    useCanvasStore.getState().updateNode(nodeId, {
      uploading: false,
      audioAssetId: asset.id,
      audioUrl: audioMediaUrl(asset.id),
      audioName: file.name,
      source: 'upload',
      assetSaved: true,
      activeResultId: undefined,
    }, { history: true });
    return true;
  } catch (error) {
    useCanvasStore.getState().updateNode(nodeId, { uploading: false, error: error instanceof Error ? error.message : '音频上传失败' });
    return false;
  }
};
