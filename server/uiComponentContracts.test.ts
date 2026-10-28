import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sourceRoot = new URL('../src/', import.meta.url);
const projectRoot = new URL('../', import.meta.url);

async function readSource(path: string) {
  return readFile(new URL(path, sourceRoot), 'utf8');
}

test('Input 和 Textarea 保留旧尺寸属性并提供统一 size 别名', async () => {
  const [input, textarea] = await Promise.all([
    readSource('components/ui/Input.tsx'),
    readSource('components/ui/Textarea.tsx'),
  ]);

  assert.match(input, /inputSize/);
  assert.match(input, /size\?: 'sm' \| 'md' \| 'lg'/);
  assert.match(textarea, /textareaSize/);
  assert.match(textarea, /size\?: 'sm' \| 'md' \| 'lg'/);
});

test('Select 使用官方 new-york Radix 标准组合，不再接受旧表单 API', async () => {
  const select = await readSource('components/ui/Select.tsx');

  assert.match(select, /from ['"]@radix-ui\/react-select['"]/);
  assert.match(select, /const Select = SelectPrimitive\.Root\b/);
  assert.match(select, /const SelectValue = SelectPrimitive\.Value\b/);
  for (const primitive of ['Trigger', 'Portal', 'Content', 'Viewport', 'Item', 'ItemText', 'ItemIndicator']) {
    assert.match(select, new RegExp(`<SelectPrimitive\\.${primitive}\\b`));
  }
  for (const component of ['Select', 'SelectTrigger', 'SelectValue', 'SelectContent', 'SelectItem']) {
    assert.match(select, new RegExp(`export\\s*\\{[^}]*\\b${component}\\b`, 's'));
  }
  assert.doesNotMatch(select, /\b(?:options|onChange|selectSize)\s*\??\s*:|\blabel\s*\?\s*:/);
  assert.doesNotMatch(select, /<select\b/);
});

test('Select 保留官方注册表来源和 new-york Radix 配置追溯', async () => {
  const [select, configSource] = await Promise.all([
    readSource('components/ui/Select.tsx'),
    readFile(new URL('components.json', projectRoot), 'utf8'),
  ]);
  const config = JSON.parse(configSource);

  assert.equal(config.$schema, 'https://ui.shadcn.com/schema.json');
  assert.equal(config.style, 'new-york');
  assert.equal(config.base, 'radix');
  assert.match(select, /@radix-ui\/react-select/);
  assert.match(select, /SelectPrimitive\.(Root|Trigger|Content|Item)/);
});

async function readComponentSources(directory = new URL('components/', sourceRoot)): Promise<Array<{ path: string; source: string }>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const sources = await Promise.all(entries.map(async (entry) => {
    const path = new URL(entry.name, directory);
    if (entry.isDirectory()) return readComponentSources(new URL(`${entry.name}/`, directory));
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) return [];
    return [{ path: path.pathname, source: await readFile(path, 'utf8') }];
  }));
  return sources.flat();
}

test('组件不得使用原生 select/range、手写 dialog 或浏览器确认输入框', async () => {
  const violations: string[] = [];
  for (const { path, source } of await readComponentSources()) {
    // Only inspect JSX opening tags for attributes; Canvas.closest selector strings are not markup.
    for (const match of source.matchAll(/<[A-Za-z][\w.:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/g)) {
      const tag = match[0];
      if (/^<select\b/.test(tag)) violations.push(`${path}: 原生 <select>`);
      if (/\btype\s*=\s*(?:["']range["']|\{\s*["']range["']\s*\})/.test(tag)) {
        violations.push(`${path}: type="range"`);
      }
      if (/\btype\s*=\s*(?:["']number["']|\{\s*["']number["']\s*\})/.test(tag)) {
        violations.push(`${path}: type="number"，请使用 NumberField`);
      }
      if (/\brole\s*=\s*(?:["']dialog["']|\{\s*["']dialog["']\s*\})/.test(tag)) {
        violations.push(`${path}: 手写 role="dialog"`);
      }
    }
    if (/\bwindow\s*\.\s*(?:confirm|prompt)\s*\(/.test(source)) {
      violations.push(`${path}: window.confirm/prompt`);
    }
  }
  assert.deepEqual(violations, [], violations.join('\n'));
});

test('组件语义变量提供控件、卡片和浮层合同', async () => {
  const css = await readSource('../src/index.css');

  for (const token of [
    '--ui-control-border',
    '--ui-control-background',
    '--ui-control-focus-ring',
    '--ui-card-background',
    '--ui-card-border',
    '--ui-popover-background',
    '--ui-popover-border',
    '--ui-popover-shadow',
  ]) {
    assert.match(css, new RegExp(`${token}:`));
  }
});

test('状态语义变量同时映射到 Tailwind 颜色合同', async () => {
  const tailwind = await readFile(new URL('tailwind.config.js', projectRoot), 'utf8');

  for (const token of ['success', 'warning', 'info']) {
    assert.match(tailwind, new RegExp(`${token}: \\{ DEFAULT: themeColor`));
    assert.match(tailwind, new RegExp(`${token}-foreground`));
  }
});
