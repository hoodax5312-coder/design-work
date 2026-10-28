import express from 'express';
import { createHiggsfieldRouter } from './higgsfieldGateway';
import { createImportRouter } from './importGateway';
import { createAssetRouter } from './assetGateway';
import { createProviderRouter } from './providerGateway';
import { createStorageRouter } from './storageGateway';
import { createLibraryRuntimeProvider } from './libraryRuntime';
import { createTaskRouter } from './taskGateway';
import { createWorkspaceRouter } from './workspaceGateway';
import { createCasesRouter, createPromptSourcesRouter } from './promptSourcesGateway';
import { createAuthRouter } from './authGateway';
import { createAdminRouter } from './adminGateway';

export const createApiApp = (projectRoot: string) => {
  const app = express();
  const getRuntime = createLibraryRuntimeProvider(projectRoot);

  app.use(express.json({ limit: '250mb' }));
  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, service: 'design-work-local' });
  });
  app.use('/api/auth', createAuthRouter(async () => (await getRuntime()).database));
  app.use('/api/admin', createAdminRouter(getRuntime));
  app.use('/api/provider', createProviderRouter(undefined, getRuntime));
  app.use('/api/storage', createStorageRouter(projectRoot));
  app.use('/api/tasks', createTaskRouter(async () => (await getRuntime()).tasks));
  app.use('/api/import', createImportRouter(getRuntime));
  app.use('/api/assets', createAssetRouter(getRuntime));
  app.use('/api/workspace', createWorkspaceRouter(projectRoot));
  app.use('/api/higgsfield', createHiggsfieldRouter(projectRoot));
  app.use('/api/prompt-sources', createPromptSourcesRouter(getRuntime));
  app.use('/api/cases', createCasesRouter(getRuntime));

  return app;
};
