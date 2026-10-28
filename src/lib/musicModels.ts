import type { ProviderProtocol } from '../types/provider';

/** 一个音乐模型在栗作中已实现的真实请求能力；界面只展示这里声明的参数。 */
export interface MusicModelCapability {
  /** 网关适配器：NewAPI 的 /audio/speech 音乐通道（metadata.music_length_ms 等）。 */
  adapter: 'newapi-audio-speech-music';
  minSeconds: number;
  maxSeconds: number;
  /** 是否可切换纯音乐 / 带人声。 */
  instrumentalToggle: boolean;
  lyrics: false;
  referenceAudio: false;
  evidence: string;
}

// 依据：DramaClaw f14b8e4 src/novelvideo/freezone/audio_node.py generate_freezone_audio_eleven_music
// 与 api/schemas.py FreezoneAudioMusicRequest（3000–600000 ms、force_instrumental，无歌词/参考音频字段）。
// 这是源码协议，尚未用真实供应商生成验证；其他模型必须补充依据后再登记，不按名称猜测。
const MUSIC_MODELS: Record<string, MusicModelCapability> = {
  'LingShan-MU-11': {
    adapter: 'newapi-audio-speech-music',
    minSeconds: 3,
    maxSeconds: 600,
    instrumentalToggle: true,
    lyrics: false,
    referenceAudio: false,
    evidence: 'DramaClaw f14b8e4  / NewAPI /audio/speech 音乐通道',
  },
};

export const MUSIC_DURATION_PRESETS = [15, 30, 60, 120, 180, 300] as const;

export const musicModelCapability = (model: string): MusicModelCapability | undefined => MUSIC_MODELS[model];

export const assertMusicModelSupported = (protocol: ProviderProtocol, model: string) => {
  const capability = musicModelCapability(model);
  if (protocol === 'anthropic-messages' || !capability) {
    throw Object.assign(new Error(`当前 ${protocol} / ${model || '未选择模型'} 没有已实现的音乐生成协议，不会发起请求。目前仅登记了 NewAPI 音乐通道 LingShan-MU-11。`), { status: 400 });
  }
  return capability;
};

export const clampMusicSeconds = (value: unknown, capability: Pick<MusicModelCapability, 'minSeconds' | 'maxSeconds'>) => {
  const seconds = Math.round(Number(value) || 30);
  return Math.min(capability.maxSeconds, Math.max(capability.minSeconds, seconds));
};
