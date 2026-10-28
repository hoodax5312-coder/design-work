import { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';

export const CaseVideoPlayer = ({ src, poster, preview = false }: {
  src: string;
  poster?: string;
  preview?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let hls: Hls | undefined;
    setFailed(false);
    const start = () => {
      if (preview) void video.play().catch(() => { /* Manual playback remains available in details. */ });
    };
    if (/\.m3u8(?:\?|$)/i.test(src) && !video.canPlayType('application/vnd.apple.mpegurl')) {
      void import('hls.js').then(({ default: HlsPlayer }) => {
        if (disposed) return;
        if (!HlsPlayer.isSupported()) { setFailed(true); return; }
        hls = new HlsPlayer();
        hls.on(HlsPlayer.Events.ERROR, (_, data) => { if (data.fatal) setFailed(true); });
        hls.on(HlsPlayer.Events.MANIFEST_PARSED, start);
        hls.loadSource(src);
        hls.attachMedia(video);
      }).catch(() => { if (!disposed) setFailed(true); });
    } else {
      video.src = src;
      start();
    }
    return () => {
      disposed = true;
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src, preview]);

  return <div className={preview ? 'relative h-full w-full' : 'relative flex h-full w-full items-center justify-center'}>
    <video ref={videoRef} poster={poster} muted={preview} loop={preview} controls={!preview} playsInline
      aria-label={preview ? '视频案例静音预览' : '视频案例播放器'}
      className={preview ? 'h-full w-full object-cover' : 'max-h-full max-w-full rounded-md object-contain'}
      onError={() => setFailed(true)} />
    {failed && <div role="status" className="absolute inset-x-2 bottom-10 rounded-md bg-black/80 p-2 text-center text-xs text-white">视频暂时无法播放，请在详情中查看原始来源</div>}
  </div>;
};
