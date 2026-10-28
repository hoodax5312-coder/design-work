import * as capabilities from '../src/lib/canvasImageCapabilities';
import * as imageInputs from '../src/components/canvas/imageInputs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { createElement, type ElementType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';

// Render the actual overlay with its store/generation dependencies stubbed; no API requests.
const renderInput = (prompt = '', kind = 'imageGen', data: Record<string, unknown> = {}) => {
  const updates: Array<Record<string, unknown>> = [];
  const buttons: Array<Record<string, any>> = [];
  let runs = 0;
  let input: Record<string, any> = {};
  const source = readFileSync(new URL('../src/components/canvas/CanvasPromptOverlay.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const jsx = (type: ElementType, props: Record<string, unknown>, key?: string) => {
    if (type === 'textarea') input = props;
    if (type === 'button') buttons.push(props);
    return jsxRuntime.jsx(type, props, key);
  };
  const Children = ({ children }: { children?: React.ReactNode }) => createElement(React.Fragment, null, children);
  const exports: Record<string, React.ComponentType<any>> = {};
  const dependencies: Record<string, unknown> = {
      '../../lib/canvasImageCapabilities': capabilities, './imageInputs': imageInputs,
    react: React,
    'react/jsx-runtime': { ...jsxRuntime, jsx, jsxs: (type: ElementType, props: Record<string, unknown>, key?: string) => {
      if (type === 'button') buttons.push(props);
      return jsxRuntime.jsxs(type, props, key);
    } },
    '@/lib/remixIconShim': new Proxy({}, { get: () => () => null }),
    '../../lib/utils': { cn: (...values: string[]) => values.filter(Boolean).join(' ') },
    '../../stores/useCanvasStore': { useCanvasStore: (select: (state: unknown) => unknown) => select({
      nodes: [], edges: [], updateNode: (_id: string, data: Record<string, unknown>) => updates.push(data),
    }) },
    '../../stores/useProviderStore': { useProviderStore: (select: (state: unknown) => unknown) => select({ providers: [], activeProviderIds: {} }) },
    '../../stores/useUIStore': { useUIStore: () => () => {} },
    '../nodes/NodeFrame': { useEditHistory: () => ({ onFocus: () => {}, beforeChange: () => {} }) },
    '../motion': { ThinkingOrb: () => null },
    '../ui': new Proxy({}, { get: () => Children }),
    './canvasModel': { IMAGE_COUNTS: [1, 2], clampCount: () => 1 },
    './CanvasReferenceImage': { CanvasReferenceImageInput: () => null },
    './referenceImage': { readReferenceImage: () => undefined },
    '../../lib/musicModels': { MUSIC_DURATION_PRESETS: [30], clampMusicSeconds: () => 30, musicModelCapability: () => undefined },
    './generation': {
      NODE_CATEGORY: { imageGen: 'image', video: 'video', text: 'language', audio: 'music' }, upstreamReferences: () => [],
      ownPrompt: (node: { data: Record<string, unknown> }) => String(node.data?.prompt || '').trim(),
      resolveModelChoice: () => ({ options: [], model: 'test-model', provider: { id: 'test', protocol: 'responses' } }),
      runNodeGeneration: () => { runs += 1; }, stopNodeGeneration: () => {},
    },
  };
  runInNewContext(compiled, { exports, require: (name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  const html = renderToStaticMarkup(createElement(exports.CanvasPromptOverlay, { id: 'test-node', kind, data: { prompt, ...data } }));
  return { input, updates, buttons, html, runs: () => runs };
};

test('画布参数采用比例图形与质量分段布局，保留原有生成参数', () => {
  const { buttons, html, updates, runs } = renderInput('', 'imageGen', { aspectRatio: '9:16', quality: 'hd' });
  assert.match(html, /<fieldset>/);
  assert.match(html, /border-\[1\.5px\]/);
  const ratios = buttons.filter((button) => String(button['aria-label']).startsWith('画面比例 '));
  assert.deepEqual(ratios.map((button) => button['aria-label']), ['画面比例 1:1', '画面比例 16:9', '画面比例 9:16']);
  assert.deepEqual(ratios.map((button) => button['aria-pressed']), [false, false, true]);
  ratios[1].onClick();
  const qualities = buttons.filter((button) => String(button['aria-label']).startsWith('质量 '));
  assert.deepEqual(qualities.map((button) => button['aria-pressed']), [false, true]);
  qualities[0].onClick();
  assert.deepEqual(updates.map((update) => ({ ...update })), [{ aspectRatio: '16:9' }, { quality: 'standard' }]);
  assert.equal(runs(), 0);
  assert.doesNotMatch(html, /分辨率/);
});

test('视频仅展示比例选项，文本不展示画面参数', () => {
  const video = renderInput('', 'video');
  assert.equal(video.buttons.filter((button) => String(button['aria-label']).startsWith('画面比例 ')).length, 3);
  assert.equal(video.buttons.some((button) => String(button['aria-label']).startsWith('质量 ')), false);
  const text = renderInput('', 'text');
  assert.equal(text.buttons.some((button) => button['aria-label'] === '画面比例'), false);
});

test('提示词由原生输入框管理，不再用旧受控值覆盖输入', () => {
  const { input, updates } = renderInput('原文');
  assert.equal(input.defaultValue, '原文');
  assert.equal(input.value, undefined);
  input.onChange({ currentTarget: { value: '原文 abc\n第二行' } });
  assert.equal(updates.at(-1)?.prompt, '原文 abc\n第二行');
});

test('中文合成期间不回写，确认后保存全文而非仅本次合成片段', () => {
  const { input, updates } = renderInput('前文 后文');
  input.onCompositionStart();
  input.onChange({ currentTarget: { value: '前文 zhongwen 后文' } });
  assert.equal(updates.length, 0);
  input.onCompositionEnd({ data: '中文', currentTarget: { value: '前文 中文 后文' } });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].prompt, '前文 中文 后文');
  input.onCompositionStart();
  input.onCompositionEnd({ data: '追加', currentTarget: { value: '前文 中文追加 后文' } });
  assert.equal(updates.at(-1)?.prompt, '前文 中文追加 后文');
});

test('输入法确认阶段不触发生成，普通快捷键仍可生成', () => {
  const { input, runs } = renderInput('提示词');
  const event = { metaKey: true, key: 'Enter', nativeEvent: { isComposing: false }, preventDefault: () => {} };
  input.onCompositionStart();
  input.onKeyDown(event);
  assert.equal(runs(), 0);
  input.onCompositionEnd({ currentTarget: { value: '提示词' } });
  input.onKeyDown({ ...event, nativeEvent: { isComposing: true } });
  input.onKeyDown({ ...event, keyCode: 229 });
  assert.equal(runs(), 0);
  input.onKeyDown(event);
  assert.equal(runs(), 1);
});
