import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiApp } from './createApiApp';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..');
const distDir = path.join(projectRoot, 'dist');
const port = Number(process.env.PORT || 4173);
// 网关保存着 API Key，默认只监听本机；确实需要局域网访问时再用 HOST 显式指定。
const host = process.env.HOST || '127.0.0.1';

const app = createApiApp(projectRoot);
app.use(express.static(distDir));
app.use((_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, host, () => {
  console.log(`栗作 LIZUO is running at http://localhost:${port}`);
});
