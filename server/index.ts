import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProviderRouter } from './providerGateway';
import { createStorageRouter } from './storageGateway';
import { createWorkspaceRouter } from './workspaceGateway';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..');
const distDir = path.join(projectRoot, 'dist');
const port = Number(process.env.PORT || 4173);

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use('/api/provider', createProviderRouter());
app.use('/api/storage', createStorageRouter(projectRoot));
app.use('/api/workspace', createWorkspaceRouter(projectRoot));
app.use(express.static(distDir));
app.use((_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Mboard is running at http://localhost:${port}`);
});
