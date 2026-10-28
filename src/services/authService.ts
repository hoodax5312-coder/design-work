export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'member';
  createdAt: number;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const request = async (path: string, credentials?: AuthCredentials): Promise<Record<string, unknown>> => {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method: path === 'me' ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      ...(credentials && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: credentials.email.trim(), password: credentials.password }),
      }),
    });
  } catch {
    throw new Error('无法连接账户服务，请确认服务已启动后重试');
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(isRecord(payload) && typeof payload.error === 'string'
      ? payload.error : '账户服务暂时不可用，请稍后重试');
  }
  if (!isRecord(payload)) throw new Error('账户服务返回无效响应，请稍后重试');
  return payload;
};

const readUser = (payload: Record<string, unknown>): AuthUser => {
  const user = payload.user;
  if (!isRecord(user) || typeof user.id !== 'string' || !user.id
    || typeof user.email !== 'string' || !user.email
    || (user.role !== 'admin' && user.role !== 'member')
    || typeof user.createdAt !== 'number' || !Number.isFinite(user.createdAt)) {
    throw new Error('账户服务返回无效身份，请稍后重试');
  }
  return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
};

export const authService = {
  async me(): Promise<AuthUser | null> {
    const payload = await request('me');
    return payload.user === null ? null : readUser(payload);
  },
  async login(credentials: AuthCredentials): Promise<AuthUser> {
    return readUser(await request('login', credentials));
  },
  async register(credentials: AuthCredentials): Promise<AuthUser> {
    return readUser(await request('register', credentials));
  },
  async logout(): Promise<void> {
    const payload = await request('logout');
    if (payload.ok !== true) throw new Error('退出登录未获确认，请重试');
  },
};
