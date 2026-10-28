import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { paginateCases } from '../src/components/assets/casePagination';
import { CaseGrid, type CaseItem, type CaseLibraryState } from '../src/components/assets/CaseLibrary';

const item: CaseItem = {
  id: 'layout-test', sourceId: 'test-source', title: '案例布局测试',
  prompt: '测试提示词', description: '', coverUrl: 'https://example.com/cover.jpg',
  tags: [], author: '', sourceUrl: 'https://example.com/case', imageModel: 'GPT Image',
};

const renderGrid = (overrides: Partial<CaseItem> = {}, saved = false) => {
  const cases = {
    visibleCaseItems: [{ ...item, ...overrides }],
    pagedCaseItems: [{ ...item, ...overrides }],
    casePage: 1, casePageCount: 1, casePageStart: 0, paginationKey: '', setCasePage: () => {},
    caseSources: [{ id: 'test-source', name: '测试来源', homepageUrl: null, itemCount: 1 }],
    savedCaseIds: new Set(saved ? [item.id] : []),
    setSelectedCase: () => {}, setCaseTag: () => {},
    downloadCaseImage: () => {}, toggleCaseFavorite: async () => {},
  } as unknown as CaseLibraryState;
  return renderToStaticMarkup(createElement(CaseGrid, { cases }));
};

test('案例卡片来源归于左侧，下载收藏归于右侧，不保留全屏按钮或封面浮层', () => {
  const html = renderGrid();
  assert.match(html, /aria-label="全屏查看案例：案例布局测试"/);
  assert.match(html, /<a href="https:\/\/example\.com\/case"[^>]+>来源：example\.com<\/a><\/div><div class="flex shrink-0 items-center gap-1"/);
  assert.doesNotMatch(html, /查看来源/);
  assert.equal((html.split('</article>')[0].match(/width="16"/g) || []).length, 3);
  assert.match(html, /aria-label="复制案例布局测试提示词"/);
  assert.doesNotMatch(html, /scale-\[/);
  assert.match(html, /aria-label="下载案例布局测试"/);
  assert.match(html, /aria-label="添加案例布局测试至收藏"/);
  assert.ok(html.indexOf('aria-label="下载案例布局测试"') < html.indexOf('aria-label="添加案例布局测试至收藏"'));
  assert.ok(html.indexOf('aria-label="添加案例布局测试至收藏"') < html.indexOf('aria-label="复制案例布局测试提示词"'));
  assert.doesNotMatch(html, /title="全屏查看"|bg-gradient-to-t|group-hover:opacity-100/);
});

test('已收藏案例可点击取消，无来源链接时保留来源名称', () => {
  const html = renderGrid({ sourceUrl: '' }, true);
  assert.match(html, /来源：测试来源<\/span>/);
  assert.match(html, /aria-pressed="true" aria-label="取消案例布局测试收藏"/);
  assert.doesNotMatch(html, /disabled=""[^>]*aria-label="取消案例布局测试收藏"/);
  assert.doesNotMatch(html, /查看来源<\/a>/);
  assert.match(html, /text-red-500/);
});

test('视频卡片保留下载视频操作，无封面卡片不展示不可用操作', () => {
  assert.match(renderGrid({ imageModel: 'Seedance 2.0' }), /title="下载封面"/);
  const video = renderGrid({ imageModel: 'Seedance 2.0', coverUrl: 'https://example.com/clip.mp4' });
  assert.match(video, /title="下载视频"/);
  assert.match(video, /preload="none"/);
  const poster = renderGrid({ imageModel: 'Seedance 2.0' });
  assert.match(poster, /<img[^>]*loading="lazy"/);
  assert.doesNotMatch(poster, /<video/);
  const html = renderGrid({ coverUrl: null });
  assert.match(html, /暂无封面/);
  assert.match(html, /aria-label="复制案例布局测试提示词"/);
  assert.doesNotMatch(html, /aria-label="下载案例布局测试"|aria-label="添加案例布局测试至收藏"/);
});

test('卡片打开详情，下载收藏操作区阻止点击冒泡且分别调用原有操作', () => {
  let selected = 0;
  let downloaded = 0;
  let saved = 0;
  let stopped = 0;
  let copied: CaseItem | undefined;
  const cases = {
    visibleCaseItems: [item], pagedCaseItems: [item],
    casePage: 1, casePageCount: 1, casePageStart: 0, paginationKey: '', setCasePage: () => {}, caseSources: [], savedCaseIds: new Set(),
    setSelectedCase: () => { selected += 1; }, setCaseTag: () => {},
    downloadCaseImage: () => { downloaded += 1; },
    copyCasePrompt: async (value: CaseItem) => { copied = value; },
    toggleCaseFavorite: async () => { saved += 1; },
  } as unknown as CaseLibraryState;
  type Props = { children?: ReactNode; role?: string; className?: string; 'aria-label'?: string; onClick?: (event: { stopPropagation: () => void }) => void };
  const elements: ReactElement<Props>[] = [];
  const visit = (node: ReactNode) => Children.forEach(node, (child) => {
    if (!isValidElement<Props>(child)) return;
    elements.push(child);
    visit(child.props.children);
  });
  visit(CaseGrid({ cases }));
  const event = { stopPropagation: () => { stopped += 1; } };
  elements.find((element) => element.type === 'a')?.props.onClick?.(event);
  elements.find((element) => element.props.className === 'flex shrink-0 items-center gap-1')?.props.onClick?.(event);
  elements.find((element) => element.props['aria-label'] === `下载${item.title}`)?.props.onClick?.(event);
  elements.find((element) => element.props['aria-label'] === `复制${item.title}提示词`)?.props.onClick?.(event);
  assert.equal(copied?.prompt, item.prompt);
  elements.find((element) => element.props['aria-label'] === `添加${item.title}至收藏`)?.props.onClick?.(event);
  assert.deepEqual({ selected, downloaded, saved, stopped }, { selected: 0, downloaded: 1, saved: 1, stopped: 2 });
  elements.find((element) => element.props.role === 'button')?.props.onClick?.(event);
  assert.equal(selected, 1);
});


test('分页每页最多50条，末页与空结果页码有效', () => {
  const items = Array.from({ length: 106 }, (_, index) => ({ ...item, id: String(index) }));
  assert.equal(paginateCases(items, 1).items.length, 50);
  assert.equal(paginateCases(items, 2).items[0].id, '50');
  assert.equal(paginateCases(items, 10).items.length, 6);
  assert.equal(paginateCases(items, 10).page, 3);
  assert.equal(paginateCases(items, 0).page, 1);
  assert.deepEqual(paginateCases([], 5), { items: [], page: 1, pageCount: 1, start: 0 });
  const pagination = paginateCases(items, 2);
  const html = renderToStaticMarkup(createElement(CaseGrid, { cases: {
    visibleCaseItems: items, pagedCaseItems: pagination.items,
    casePage: 2, casePageCount: 3, casePageStart: 50, paginationKey: '', setCasePage: () => {},
    caseSources: [], savedCaseIds: new Set(), setSelectedCase: () => {}, setCaseTag: () => {},
    downloadCaseImage: () => {}, toggleCaseFavorite: async () => {},
  } as unknown as CaseLibraryState }));
  assert.equal((html.match(/aria-label="全屏查看案例：/g) || []).length, 50);
  assert.match(html, /aria-label="案例分页"/);
  assert.match(html, /51–100/);
});
