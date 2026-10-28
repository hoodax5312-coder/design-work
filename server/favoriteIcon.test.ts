import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Heart, HeartFill } from '../src/lib/remixIconShim';
import { FavoriteIcon } from '../src/components/ui/FavoriteIcon';

const pathOf = (html: string) => html.match(/<path d="([^"]+)"/)?.[1];

test('未收藏使用空心图标，不显示收藏红色', () => {
  const html = renderToStaticMarkup(createElement(FavoriteIcon, { size: 16 }));
  assert.equal(pathOf(html), pathOf(renderToStaticMarkup(createElement(Heart))));
  assert.doesNotMatch(html, /text-red-500/);
});

test('已收藏使用红色实心图标，覆盖继承的主题前景色', () => {
  const html = renderToStaticMarkup(createElement(FavoriteIcon, { saved: true, className: 'text-white', size: 16 }));
  assert.equal(pathOf(html), pathOf(renderToStaticMarkup(createElement(HeartFill))));
  assert.notEqual(pathOf(html), pathOf(renderToStaticMarkup(createElement(Heart))));
  assert.match(html, /text-red-500/);
  assert.doesNotMatch(html, /text-white/);
});
