import { Router } from 'express';
import type { TaskStatus } from './repositories/TaskRepository';
import type { TaskRunner } from './tasks/TaskRunner';

const taskStatuses = new Set<TaskStatus>([
  'queued',
  'running',
  'waiting_for_user',
  'completed',
  'failed',
  'cancelled',
]);

export const createTaskRouter = (getRunner: () => Promise<TaskRunner>) => {
  const router = Router();

  router.get('/', async (request, response, next) => {
    try {
      const statusValue = String(request.query.status || '');
      const status = taskStatuses.has(statusValue as TaskStatus)
        ? statusValue as TaskStatus
        : undefined;
      const runner = await getRunner();
      response.json({
        items: runner.list({
          status,
          type: request.query.type ? String(request.query.type) : undefined,
          limit: Number(request.query.limit || 100),
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:taskId', async (request, response, next) => {
    try {
      const task = (await getRunner()).get(request.params.taskId);
      if (!task) {
        response.status(404).json({ error: '任务不存在' });
        return;
      }
      response.json(task);
    } catch (error) {
      next(error);
    }
  });

  router.post('/start', async (request, response, next) => {
    try {
      const type = typeof request.body?.type === 'string' ? request.body.type.trim() : '';
      if (!type) {
        response.status(400).json({ error: '缺少任务类型' });
        return;
      }
      const runner = await getRunner();
      const result = runner.start(
        type,
        request.body?.input && typeof request.body.input === 'object' ? request.body.input : {},
        typeof request.body?.dedupeKey === 'string' ? request.body.dedupeKey : null,
      );
      response.status(result.created ? 202 : 200).json({ ...result, task: runner.get(result.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:taskId/retry', async (request, response, next) => {
    try {
      response.status(202).json((await getRunner()).retry(request.params.taskId));
    } catch (error) {
      next(error);
    }
  });

  router.post('/:taskId/cancel', async (request, response, next) => {
    try {
      response.json((await getRunner()).cancel(request.params.taskId));
    } catch (error) {
      next(error);
    }
  });

  router.use((error: Error, _request: unknown, response: { status: (code: number) => { json: (body: unknown) => void } }, _next: unknown) => {
    response.status(400).json({ error: error.message || '任务操作失败' });
  });

  return router;
};
