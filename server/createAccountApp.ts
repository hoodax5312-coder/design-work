import express from 'express';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { createAuthRouter } from './authGateway';
import { createAdminRouter } from './adminGateway';
import { createAccountAccess } from './accountAccess';

// Deliberately does not import createApiApp: no local files, providers or workspace endpoints.
export const createAccountApp = (options: {
  database: DatabaseSync;
  publicOrigin: string;
  projectRoot: string;
}) => {
  const app = express();
  const access = createAccountAccess(options.publicOrigin);
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use((_request, response, next) => {
    response.set('X-Content-Type-Options', 'nosniff');
    response.set('Referrer-Policy', 'same-origin');
    response.set('X-Frame-Options', 'DENY');
    next();
  });
  app.use('/api', access, express.json({ limit: '8kb' }));
  app.get('/api/health', (_request, response) => response.json({ ok: true, service: 'lizu-account' }));
  const getDatabase = async () => options.database;
  app.use('/api/auth', createAuthRouter(getDatabase, { access, secureCookies: true }));
  app.use('/api/admin', createAdminRouter(async () => ({ database: options.database }), access));
  app.use('/api', (_request, response) => response.status(404).json({ error: '此在线服务不提供本机文件或模型操作' }));
  app.use('/admin', (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    response.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  }, express.static(path.join(options.projectRoot, 'dist-admin')));
  app.get(['/admin', '/admin/{*path}'], (_request, response) => response.sendFile(path.join(options.projectRoot, 'dist-admin/index.html')));
  app.use(express.static(path.join(options.projectRoot, 'dist')));
  app.get('/{*path}', (_request, response) => response.sendFile(path.join(options.projectRoot, 'dist/index.html')));
  app.use((error: Error & { status?: number }, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 500;
    response.status(status).json({ error: status === 413 ? '请求内容过大' : status === 400 ? '请求格式不正确' : '服务暂时不可用' });
  });
  return app;
};
