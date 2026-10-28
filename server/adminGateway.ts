import { Router, type RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { requireAuth } from './authGateway';
import { localAccountAccess } from './localAccountAccess';

export const createAdminRouter = (getRuntime: () => Promise<{ database: DatabaseSync }>, access: RequestHandler = localAccountAccess) => {
  const router = Router();
  router.use(access);

  router.get('/summary', async (request, response, next) => {
    try {
      const runtime = await getRuntime();
      const user = requireAuth(runtime.database, request);
      if (user.role !== 'admin') {
        response.status(403).json({ error: '只有管理员可以访问管理后台' });
        return;
      }
      const userCount = Number(runtime.database.prepare('SELECT COUNT(*) AS count FROM users').get()?.count || 0);
      const activeSessions = Number(runtime.database.prepare('SELECT COUNT(*) AS count FROM sessions WHERE expires_at > ?').get(Date.now())?.count || 0);
      const assetCount = Number(runtime.database.prepare("SELECT COUNT(*) AS count FROM assets WHERE status = 'active'").get()?.count || 0);
      response.json({
        user,
        metrics: { users: userCount, activeSessions, assets: assetCount },
        status: { database: '正常', auth: '正常' },
      });
    } catch (error) {
      next(error);
    }
  });

  router.use((error: Error & { status?: number }, _request: unknown, response: { status: (code: number) => { json: (body: unknown) => void } }, _next: unknown) => {
    response.status(error.status || 500).json({ error: error.status ? error.message : '管理后台暂时不可用' });
  });

  return router;
};
