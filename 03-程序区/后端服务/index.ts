import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiApp } from './createApiApp';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..');
const distDir = path.join(projectRoot, 'dist');
const port = Number(process.env.PORT || 4173);

const app = createApiApp(projectRoot);
app.use(express.static(distDir));
app.use((_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Design Work is running at http://localhost:${port}`);
});
