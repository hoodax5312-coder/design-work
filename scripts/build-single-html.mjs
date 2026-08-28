import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const outputDir = path.join(root, 'output');
const htmlPath = path.join(distDir, 'index.html');
const html = await readFile(htmlPath, 'utf8');

const scriptMatch = html.match(/<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
const styleMatch = html.match(/<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);

if (!scriptMatch || !styleMatch) {
  throw new Error('无法在 dist/index.html 中找到构建后的脚本或样式资源。');
}

const resolveAsset = (assetPath) => path.resolve(distDir, assetPath.replace(/^\.\//, ''));
const [script, style] = await Promise.all([
  readFile(resolveAsset(scriptMatch[1]), 'utf8'),
  readFile(resolveAsset(styleMatch[1]), 'utf8'),
]);

// The standalone file uses a classic inline script so it can be opened from file://.
// Fail the build if Vite ever emits module-only syntax or the bundle is malformed.
new Script(script, { filename: 'design-work-standalone.js' });

const standalone = html
  .replace(styleMatch[0], () => `<style>\n${style.replaceAll('</style', '<\\/style')}\n</style>`)
  .replace(scriptMatch[0], '')
  .replace('</body>', () => `<script>\n${script.replaceAll('</script', '<\\/script')}\n</script>\n</body>`)
  .replace('</head>', '  <meta name="design-work-build" content="standalone" />\n  </head>');

const rootPosition = standalone.indexOf('id="root"');
const runtimePosition = standalone.lastIndexOf('<script>');
if (rootPosition < 0 || runtimePosition <= rootPosition) {
  throw new Error('单文件运行脚本必须位于 #root 元素之后。');
}
if (/<script[^>]+src=|<link[^>]+href=/.test(standalone)) {
  throw new Error('单文件 HTML 中仍存在外部脚本或样式引用。');
}

await mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'LIZUO-standalone.html');
await writeFile(outputPath, standalone, 'utf8');

console.log(`单文件 HTML 已生成：${outputPath}`);
