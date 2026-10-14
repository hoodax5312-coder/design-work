import assert from 'node:assert/strict';
import test from 'node:test';
import { isCaseVideo } from '../src/components/assets/caseMedia';

test('Seedance 案例默认按视频展示', () => {
  assert.equal(isCaseVideo({ imageModel: 'Seedance 2.0', coverUrl: 'https://cdn.example.com/clip' }), true);
  assert.equal(isCaseVideo({ imageModel: 'custom-model', coverUrl: 'https://cdn.example.com/clip.mp4' }), true);
  assert.equal(isCaseVideo({ imageModel: 'GPT Image', coverUrl: 'https://cdn.example.com/poster.webp' }), false);
});
