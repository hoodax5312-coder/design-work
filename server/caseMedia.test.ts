import assert from 'node:assert/strict';
import test from 'node:test';
import { getCasePlaybackUrl, getCaseVideoUrl, isCaseVideo } from '../src/components/assets/caseMedia';

test('Seedance 案例默认按视频展示', () => {
  assert.equal(isCaseVideo({ imageModel: 'Seedance 2.0', coverUrl: 'https://cdn.example.com/clip' }), true);
  assert.equal(isCaseVideo({ imageModel: 'custom-model', coverUrl: 'https://cdn.example.com/clip.mp4' }), true);
  assert.equal(isCaseVideo({ imageModel: 'GPT Image', coverUrl: 'https://cdn.example.com/poster.webp' }), false);
});

test('Cloudflare Stream封面使用同一视频ID的HLS播放列表，不将HLS伪装成MP4下载', () => {
  const item = { imageModel: 'Seedance 2.0', coverUrl: 'https://customer-qs6wnyfuv0gcybzj.cloudflarestream.com/e066fab457509bc6809ea212ae5d6a51/thumbnails/thumbnail.jpg' };
  assert.equal(getCasePlaybackUrl(item), 'https://customer-qs6wnyfuv0gcybzj.cloudflarestream.com/e066fab457509bc6809ea212ae5d6a51/manifest/video.m3u8');
  assert.equal(getCaseVideoUrl(item), null);
});

test('显式视频地址优先，普通封面、网页、伪造Stream域名不进入播放器', () => {
  assert.equal(getCasePlaybackUrl({ coverUrl: 'https://example.com/poster.jpg', videoUrl: 'https://example.com/video.m3u8' }), 'https://example.com/video.m3u8');
  assert.equal(getCasePlaybackUrl({ mediaType: 'video', sourceUrl: 'https://example.com/video.mp4' }), 'https://example.com/video.mp4');
  for (const coverUrl of ['https://example.com/poster.jpg', 'https://x.com/user/status/1', 'https://customer-a.cloudflarestream.com.evil.test/e066fab457509bc6809ea212ae5d6a51/thumbnails/thumbnail.jpg', 'not a url']) {
    assert.equal(getCasePlaybackUrl({ mediaType: 'video', coverUrl }), null);
  }
});

test('视频模型的JPG封面不能作为视频播放，直链视频才进入播放器', () => {
  assert.equal(getCaseVideoUrl({ imageModel: 'Seedance 2.0', coverUrl: 'https://cdn.example.com/thumbnails/thumbnail.jpg' }), null);
  assert.equal(getCaseVideoUrl({ imageModel: 'grok-imagine', coverUrl: 'https://pbs.twimg.com/preview.jpg' }), null);
  assert.equal(getCaseVideoUrl({ coverUrl: 'https://cdn.example.com/clip.mp4?token=test' }), 'https://cdn.example.com/clip.mp4?token=test');
  assert.equal(getCaseVideoUrl({ mediaType: 'video', coverUrl: null }), null);
});
