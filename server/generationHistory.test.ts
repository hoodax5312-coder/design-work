import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGenerationHistory } from '../src/components/image-gen/generationHistory';

const record = (id: string, mode?: 'image' | 'video', output = `${id}.png`) => ({
  id,
  prompt: id,
  createdAt: '2026-09-04T00:00:00.000Z',
  model: 'test-model',
  ratio: '16:9',
  resolution: '2k',
  quality: '中',
  outputs: [output],
  ...(mode ? { mode } : {}),
});

test('生成历史按记录类型归入图片和视频分组', () => {
  const normalized = normalizeGenerationHistory({
    image: [record('misplaced-video', 'video', 'video.mp4'), record('legacy-image')],
    video: [record('video', 'video', 'other-video.mp4'), record('legacy-video')],
  });

  assert.deepEqual(normalized.image.map((item) => item.id), ['legacy-image']);
  assert.deepEqual(normalized.video.map((item) => item.id), ['misplaced-video', 'video', 'legacy-video']);
  assert.ok(normalized.image.every((item) => item.mode === 'image'));
  assert.ok(normalized.video.every((item) => item.mode === 'video'));
});
