import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// 直接读取源码中的 Default 暗黑色板，防止后续改动把层级或对比度改回不可读。
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const block = css.match(/:root\.dark\[data-theme='nature'\]\s*\{([\s\S]*?)\n {2}\}/)?.[1] ?? '';

const token = (name: string) => {
  const value = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  assert.ok(value, `missing --${name}`);
  return value;
};

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const surfaces = ['lz-canvas', 'lz-shell', 'lz-card', 'lz-field', 'lz-overlay', 'lz-hover', 'lz-selected'];

test('dark surfaces step up in a strict lightness order', () => {
  const values = surfaces.map((name) => luminance(token(name)));
  values.slice(1).forEach((value, index) => assert.ok(value > values[index], `${surfaces[index + 1]} must be lighter than ${surfaces[index]}`));
});

test('every text tier stays readable on every surface (4.5:1)', () => {
  for (const text of ['lz-text', 'lz-text-secondary', 'lz-text-muted']) {
    for (const surface of surfaces) {
      assert.ok(contrast(token(text), token(surface)) >= 4.5, `${text} on ${surface}`);
    }
  }
});

// 输入框停留状态要能被认出来，焦点要能和这道边线区分开，两者都按 WCAG 1.4.11 的 3:1 算。
const controlSurfaces = ['lz-canvas', 'lz-shell', 'lz-card', 'lz-field', 'lz-overlay'];

test('resting control borders identify inputs on every surface they sit on (3:1)', () => {
  for (const surface of controlSurfaces) {
    assert.ok(contrast(token('lz-control-border'), token(surface)) >= 3, `control border on ${surface}`);
  }
});

test('focus ring separates from both the surface and the resting border', () => {
  for (const surface of controlSurfaces) {
    assert.ok(contrast(token('lz-focus'), token(surface)) >= 3, `focus on ${surface}`);
  }
  assert.ok(contrast(token('lz-focus'), token('lz-control-border')) >= 3, 'focus vs resting border');
});

test('canvas edges meet the 3:1 non-text minimum', () => {
  assert.ok(contrast(token('lz-edge'), token('lz-canvas')) >= 3);
  assert.ok(contrast(token('lz-edge'), token('lz-card')) >= 3);
});

// 内容容器和左侧外壳之间没有边线，只能靠底色区分，必须保证这层明度差看得见。
test('content container separates from the shell without a border', () => {
  assert.ok(contrast(token('lz-canvas'), token('lz-shell')) >= 1.13);
});

test('shadcn and project aliases map to the semantic palette instead of raw colors', () => {
  const aliases: Record<string, string> = {
    background: 'lz-canvas',
    card: 'lz-card',
    popover: 'lz-overlay',
    muted: 'lz-field',
    accent: 'lz-hover',
    ring: 'lz-focus',
    'workspace-bg': 'lz-shell',
    'module-workspace-bg': 'lz-canvas',
    'neutral-field-surface': 'lz-field',
    'neutral-border': 'lz-control-border',
    'field-focus-ring': 'lz-focus',
    'canvas-edge-color': 'lz-edge',
    'canvas-surface-raised': 'lz-card',
  };
  for (const [alias, source] of Object.entries(aliases)) {
    assert.match(block, new RegExp(`--${alias}:\\s*var\\(--${source}\\)`), `--${alias}`);
  }
});

test('generic .dark keeps its own values so other themes are untouched', () => {
  const generic = css.match(/\n {2}\.dark\s*\{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
  assert.match(generic, /--background:\s*lab\(0% 0 0\)/);
  assert.doesNotMatch(generic, /--lz-/);
});

test('parameter popovers share one surface and lift the selected segment above the track', () => {
  // 生成页“参数设置”与画布“画面参数”必须吃同一组规则，否则又会一边有描边一边没有。
  assert.match(css, /\.parameter-popover\s*\{\s*--generation-control-border:\s*transparent;\s*--generation-control-bg:\s*var\(--neutral-field-surface\);/);
  assert.match(css, /:root\.dark\[data-theme='nature'\] \.parameter-popover\s*\{\s*--generation-control-bg:\s*var\(--lz-card\);/);
  assert.match(block, /--neutral-control-selected:\s*var\(--lz-selected\)/);
  assert.ok(luminance(token('lz-selected')) > luminance(token('lz-card')), 'selected segment must be lighter than the track');
});
