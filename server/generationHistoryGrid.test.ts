import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GenerationHistoryGrid } from '../src/components/image-gen/GenerationHistoryGrid';
import type { GenerationRecord } from '../src/components/image-gen/generationHistory';

const record: GenerationRecord = {
  id: 'history-test', prompt: '测试作品', createdAt: '2026-10-25T00:00:00Z',
  model: 'test', ratio: '1:1', resolution: '2k', quality: '中',
  mode: 'image', outputs: ['/one.png', '/two.png'],
};

const renderGrid = (records: GenerationRecord[], savedUrls = new Set<string>()) => renderToStaticMarkup(createElement(GenerationHistoryGrid, {
  records, savedUrls, onOpen: () => {}, onContextMenu: () => {}, onEdit: () => {},
  onCopy: () => {}, onSave: () => {}, onDownload: () => {},
}));

test('宫格按输出展开多图记录，保留完整图片和全屏入口', () => {
  const html = renderGrid([record]);
  assert.equal((html.match(/<article /g) || []).length, 2);
  assert.match(html, /src="\/one.png"/);
  assert.match(html, /src="\/two.png"/);
  assert.match(html, /全屏查看图片：测试作品（第 2 张）/);
  assert.match(html, /break-inside-avoid/);
  assert.doesNotMatch(html, /object-cover/);
});

test('收藏状态对应单个输出，保留编辑、复制与下载操作', () => {
  const html = renderGrid([record], new Set(['/two.png']));
  assert.equal((html.match(/>已收藏<\/span>/g) || []).length, 1);
  assert.equal((html.match(/text-red-500/g) || []).length, 1);
  assert.match(html, /<button(?=[^>]*aria-label="取消收藏")(?=[^>]*aria-pressed="true")[^>]*>/);
  assert.doesNotMatch(html, /<button[^>]*disabled=/);
  for (const label of ['编辑提示词', '复制提示词', '下载图片', '添加至收藏']) {
    assert.ok(html.includes(`aria-label="${label}"`));
  }
});

test('视频使用视频预览和视频操作，空记录不渲染卡片', () => {
  const html = renderGrid([{ ...record, mode: 'video', outputs: ['/clip.mp4'] }]);
  assert.match(html, /<video /);
  assert.doesNotMatch(html, /<img /);
  assert.match(html, /aria-label="下载视频"/);
  assert.match(html, /全屏查看视频/);
  assert.doesNotMatch(renderGrid([]), /<article /);
});
