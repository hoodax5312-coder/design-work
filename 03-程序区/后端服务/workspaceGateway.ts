import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { Router } from 'express';

const execFileAsync = promisify(execFile);

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';

export const createWorkspaceRouter = (projectRoot: string) => {
  const router = Router();

  router.post('/reveal', async (_request, response, next) => {
    try {
      await execFileAsync('open', [projectRoot]);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post('/worktree', async (request, response, next) => {
    try {
      const projectName = String(request.body?.projectName || 'project');
      const projectId = String(request.body?.projectId || Date.now());
      const branch = `design-work/${slugify(projectName)}-${projectId.slice(0, 8)}`;
      const worktreeRoot = path.join(path.dirname(projectRoot), '.design-work-worktrees');
      const worktreePath = path.join(worktreeRoot, slugify(projectName));

      await execFileAsync('mkdir', ['-p', worktreeRoot]);
      await execFileAsync('git', ['worktree', 'add', '-b', branch, worktreePath], {
        cwd: projectRoot,
      });
      response.json({ ok: true, path: worktreePath, branch });
    } catch (error) {
      next(error);
    }
  });

  router.use(
    (
      error: Error,
      _request: unknown,
      response: { status: (code: number) => { json: (body: unknown) => void } },
      _next: unknown,
    ) => {
      response.status(500).json({
        error: error.message || '本地工作区操作失败',
      });
    },
  );

  return router;
};
