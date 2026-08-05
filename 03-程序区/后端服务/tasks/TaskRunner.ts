import type { TaskRecord } from '../repositories/TaskRepository';
import { TaskRepository } from '../repositories/TaskRepository';

export interface TaskContext {
  taskId: string;
  signal: AbortSignal;
  updateProgress: (progress: number, currentStep?: string) => void;
  waitForUser: (output?: unknown) => never;
}

export type TaskHandler = (
  input: Record<string, unknown>,
  context: TaskContext,
) => Promise<unknown>;

class WaitingForUserError extends Error {
  constructor(readonly output: unknown) {
    super('TASK_WAITING_FOR_USER');
  }
}

const serializeError = (error: unknown) => ({
  name: error instanceof Error ? error.name : 'Error',
  message: error instanceof Error ? error.message : String(error),
});

export class TaskRunner {
  private readonly handlers = new Map<string, TaskHandler>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly active = new Map<string, Promise<void>>();

  constructor(
    readonly repository: TaskRepository,
    private readonly onUnhandledError: (error: unknown) => void = console.error,
  ) {}

  register(type: string, handler: TaskHandler) {
    if (this.handlers.has(type)) throw new Error(`任务处理器已注册：${type}`);
    this.handlers.set(type, handler);
    for (const task of this.repository.list({ status: 'queued', type, limit: 500 })) {
      this.schedule(task.id);
    }
  }

  supportedTypes() {
    return [...this.handlers.keys()].sort();
  }

  start(type: string, input: Record<string, unknown> = {}, dedupeKey: string | null = null) {
    if (!this.handlers.has(type)) throw new Error(`未知任务类型：${type}`);
    const result = this.repository.createUnique(type, input, dedupeKey);
    if (result.created) this.schedule(result.id);
    return result;
  }

  recover() {
    this.repository.recoverRunning();
    for (const task of this.repository.list({ status: 'queued', limit: 500 })) {
      if (this.handlers.has(task.type)) this.schedule(task.id);
    }
  }

  retry(id: string) {
    const task = this.requireTask(id);
    if (!this.handlers.has(task.type)) throw new Error(`任务处理器不可用：${task.type}`);
    if (!this.repository.prepareRetry(id)) throw new Error('只有失败或已取消的任务可以重试');
    this.schedule(id);
    return this.requireTask(id);
  }

  cancel(id: string) {
    const task = this.requireTask(id);
    if (!['queued', 'running', 'waiting_for_user'].includes(task.status)) {
      throw new Error('任务当前状态无法取消');
    }
    this.repository.setStatus(id, 'cancelled', { currentStep: '已取消' });
    this.controllers.get(id)?.abort();
    return this.requireTask(id);
  }

  get(id: string) {
    return this.repository.get(id);
  }

  list(options: Parameters<TaskRepository['list']>[0] = {}) {
    return this.repository.list(options);
  }

  async waitForIdle() {
    await Promise.all([...this.active.values()]);
  }

  private requireTask(id: string): TaskRecord {
    const task = this.repository.get(id);
    if (!task) throw new Error('任务不存在');
    return task;
  }

  private schedule(id: string) {
    if (this.active.has(id)) return;
    const promise = Promise.resolve()
      .then(() => this.execute(id))
      .catch(this.onUnhandledError)
      .finally(() => {
        this.active.delete(id);
        this.controllers.delete(id);
      });
    this.active.set(id, promise);
  }

  private async execute(id: string) {
    const task = this.requireTask(id);
    const handler = this.handlers.get(task.type);
    if (!handler || !this.repository.markRunning(id)) return;
    const controller = new AbortController();
    this.controllers.set(id, controller);

    try {
      const output = await handler(task.input, {
        taskId: id,
        signal: controller.signal,
        updateProgress: (progress, currentStep) => {
          this.repository.updateProgress(id, progress, currentStep);
        },
        waitForUser: (waitingOutput) => {
          throw new WaitingForUserError(waitingOutput);
        },
      });
      if (this.repository.get(id)?.status === 'running') {
        this.repository.setStatus(id, 'completed', {
          progress: 1,
          currentStep: '已完成',
          output,
          error: null,
        });
      }
    } catch (error) {
      if (this.repository.get(id)?.status === 'cancelled') return;
      if (error instanceof WaitingForUserError) {
        this.repository.setStatus(id, 'waiting_for_user', {
          currentStep: '等待用户确认',
          output: error.output,
          error: null,
        });
        return;
      }
      this.repository.setStatus(id, 'failed', {
        currentStep: '执行失败',
        error: serializeError(error),
      });
    }
  }
}
