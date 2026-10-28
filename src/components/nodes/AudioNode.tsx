import { memo, useEffect, useRef, useState } from 'react';
import { type Node, type NodeProps } from '@xyflow/react';
import { Download, Music, Pause, Play, RefreshCw, Upload } from '@/lib/remixIconShim';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { AuroraVeil, ThinkingOrb } from '../motion';
import { nodeTitle } from '../canvas/canvasModel';
import { AUDIO_ACCEPT, uploadAudioToNode } from '../canvas/audioUpload';
import { downloadMedia, useCanvasActions } from '../canvas/canvasContext';
import { isNodeRunnable, ownPrompt, runNodeGeneration } from '../canvas/generation';
import { Slider } from '../ui';
import { NodeFrame, type NodeAction } from './NodeFrame';

type CanvasAudioNode = Node<Record<string, unknown>>;

/** 画布上同一时间只播放一个音频。 */
let playingAudio: HTMLAudioElement | null = null;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

export const AudioNode = memo(({ id, data, selected }: NodeProps<CanvasAudioNode>) => {
  const runnable = useCanvasStore((state) => {
    const node = state.nodes.find((item) => item.id === id);
    return Boolean(node) && isNodeRunnable(node as Node, state.nodes, state.edges);
  });
  const { notify } = useCanvasActions();
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(Number.NaN);
  const [loadError, setLoadError] = useState('');
  const audioUrl = typeof data.audioUrl === 'string' ? data.audioUrl : '';
  const audioName = typeof data.audioName === 'string' ? data.audioName : '';
  const generating = Boolean(data.isGenerating);
  const uploading = Boolean(data.uploading);
  const isSelected = Boolean(selected);
  const title = nodeTitle({ type: 'audio', data });
  const prompt = ownPrompt({ type: 'audio', data });

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(Number.NaN);
    setLoadError('');
  }, [audioUrl]);

  // 卸载或换文件时停止播放，不在后台继续出声。
  useEffect(() => {
    const element = audioRef.current;
    return () => {
      element?.pause();
      if (playingAudio === element) playingAudio = null;
    };
  }, [audioUrl]);

  const toggle = () => {
    const element = audioRef.current;
    if (!element || loadError) return;
    if (!element.paused) { element.pause(); return; }
    if (playingAudio && playingAudio !== element) playingAudio.pause();
    playingAudio = element;
    void element.play().catch(() => setLoadError('浏览器无法播放这个音频'));
  };

  const fileName = audioName && /\.[a-z0-9]+$/i.test(audioName) ? audioName : `${title}.mp3`;
  const actions: NodeAction[] = [
    {
      id: 'regenerate',
      icon: RefreshCw,
      label: audioUrl && data.source !== 'upload' ? '再次生成' : '生成',
      disabled: uploading || !runnable,
      onSelect: () => void runNodeGeneration(id),
    },
    { id: 'upload', icon: Upload, label: audioUrl ? '替换为本地音频' : '上传音频', disabled: uploading || generating, onSelect: () => fileRef.current?.click() },
    {
      id: 'download',
      icon: Download,
      label: '下载',
      disabled: !audioUrl || Boolean(loadError),
      onSelect: () => void downloadMedia(audioUrl, fileName).then((ok) => { if (!ok) notify('已在新标签页打开音频，可在那里另存'); }),
    },
  ];

  return (
    <NodeFrame id={id} kind="audio" data={data} selected={isSelected} resize="width" actions={actions}>
      <input ref={fileRef} type="file" accept={AUDIO_ACCEPT} aria-label="选择音频文件" className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void uploadAudioToNode(id, file);
        }} />
      {audioUrl ? (
        <div className="flex h-full w-full flex-col justify-center gap-2 px-4">
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="metadata"
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
            onDurationChange={(event) => setDuration(event.currentTarget.duration)}
            onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setLoadError('音频无法加载：资产可能已删除，或格式不受浏览器支持')}
          />
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              disabled={Boolean(loadError)}
              aria-label={playing ? '暂停音频' : '播放音频'}
              className="nodrag grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground text-background transition-transform duration-150 hover:scale-105 active:scale-95 disabled:opacity-35"
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground" title={audioName || title}>{audioName || title}</p>
              <p className="text-[11px] tabular-nums text-muted-foreground">{loadError || `${formatTime(current)} / ${formatTime(duration)}`}</p>
            </div>
          </div>
          <Slider
            aria-label="播放进度"
            min={0}
            max={Number.isFinite(duration) && duration > 0 ? duration : 1}
            step={0.1}
            value={[Math.min(current, Number.isFinite(duration) ? duration : 0)]}
            disabled={!Number.isFinite(duration) || duration <= 0 || Boolean(loadError)}
            onValueChange={([next]) => {
              const element = audioRef.current;
              if (element) element.currentTime = next;
              setCurrent(next);
            }}
            className="canvas-audio-progress nodrag nopan nowheel w-full"
          />
        </div>
      ) : !generating && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/40 px-4 text-muted-foreground">
          <Music size={22} className="opacity-70" />
          {uploading ? (
            <span className="text-xs">正在上传到资产库…</span>
          ) : prompt && !isSelected ? (
            <span className="line-clamp-2 max-w-full whitespace-pre-wrap break-words text-center text-xs leading-5 text-foreground/70">{prompt}</span>
          ) : (
            <span className="text-xs">{isSelected ? '在下方描述配乐需求，或上传本地音频' : '选中后描述配乐需求'}</span>
          )}
        </div>
      )}
      {generating && (
        <>
          <AuroraVeil />
          <div className="absolute inset-0 grid place-items-center"><ThinkingOrb size={40} /></div>
        </>
      )}
    </NodeFrame>
  );
});

AudioNode.displayName = 'AudioNode';
