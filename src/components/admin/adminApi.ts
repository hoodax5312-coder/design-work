export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'member';
  createdAt: number;
}

export interface AdminSummary {
  user: AdminUser;
  metrics: { users: number; activeSessions: number; assets: number };
  status: { database: string; auth: string };
}

export class AdminRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function adminRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  // Do not mistake a Vite HTML fallback or a failed request for an authenticated response.
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(body) && typeof body.error === 'string' ? body.error : `请求失败（${response.status}）`;
    throw new AdminRequestError(message, response.status);
  }
  return body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUser(value: unknown): value is AdminUser {
  return isRecord(value) && typeof value.id === 'string' && typeof value.email === 'string'
    && (value.role === 'admin' || value.role === 'member') && typeof value.createdAt === 'number';
}

export function readSession(body: unknown): AdminUser | null {
  if (!isRecord(body) || !(body.user === null || isUser(body.user))) {
    throw new Error('账户服务返回格式异常，请稍后重试。');
  }
  return body.user;
}

export function readSummary(body: unknown): AdminSummary {
  if (!isRecord(body) || !isUser(body.user) || body.user.role !== 'admin'
    || !isRecord(body.metrics) || !isRecord(body.status)
    || !['users', 'activeSessions', 'assets'].every((key) => {
      const value = (body.metrics as Record<string, unknown>)[key];
      return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
    }) || typeof body.status.database !== 'string' || typeof body.status.auth !== 'string') {
    throw new Error('统计服务返回格式异常，未展示未经确认的数据。');
  }
  return body as unknown as AdminSummary;
}
