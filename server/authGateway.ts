import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { Router, type RequestHandler } from 'express';
import { localAccountAccess } from './localAccountAccess';
import { createAuthRateLimit } from './accountAccess';
import { withTransaction } from './database';

export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'member';
  createdAt: number;
}

type AuthDatabase = Pick<DatabaseSync, 'prepare'>;

const SESSION_COOKIE = 'lizu_session';
const SESSION_DAYS = 30;

const jsonError = (message: string, status: number) => Object.assign(new Error(message), { status });

const normalizeEmail = (value: unknown) => {
  if (typeof value !== 'string') throw jsonError('请输入邮箱', 400);
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw jsonError('请输入有效的邮箱地址', 400);
  return email;
};

const readPassword = (value: unknown) => {
  if (typeof value !== 'string' || value.length < 8) throw jsonError('密码至少需要 8 位', 400);
  if (value.length > 200) throw jsonError('密码不能超过 200 位', 400);
  return value;
};

const deriveKey = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, (error, result) => error ? reject(error) : resolve(result));
});

const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await deriveKey(password, salt)).toString('hex')}`;
};

const verifyPassword = async (password: string, stored: string) => {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await deriveKey(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const parseCookies = (header: string | undefined) => Object.fromEntries(
  (header || '').split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return [];
    const value = part.slice(separator + 1).trim();
    return [[part.slice(0, separator).trim(), /^[a-zA-Z0-9-]{1,128}$/.test(value) ? value : '']];
  }),
);

const cookie = (value: string, maxAge: number, secure: boolean) => [
  `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
  'Path=/',
  'HttpOnly',
  'SameSite=Lax',
  ...(secure ? ['Secure'] : []),
  `Max-Age=${maxAge}`,
].join('; ');

const mapUser = (row: Record<string, unknown>): AuthUser => ({
  id: String(row.id),
  email: String(row.email),
  role: row.role === 'admin' ? 'admin' : 'member',
  createdAt: Number(row.created_at),
});

const sessionHash = (token: string) => createHash('sha256').update(token).digest('hex');
const dummyPasswordHash = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

const findUserBySession = (database: AuthDatabase, sessionId: string | undefined) => {
  if (!sessionId) return null;
  const row = database.prepare(`
    SELECT users.id, users.email, users.role, users.created_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ? AND sessions.expires_at > ?
  `).get(sessionHash(sessionId), Date.now()) as Record<string, unknown> | undefined;
  return row ? mapUser(row) : null;
};

export const requireAuth = (database: AuthDatabase, request: { headers: { cookie?: string } }) => {
  const user = findUserBySession(database, parseCookies(request.headers.cookie)[SESSION_COOKIE]);
  if (!user) throw jsonError('请先登录', 401);
  return user;
};

export const createAuthRouter = (getDatabase: () => Promise<DatabaseSync>, options: {
  access?: RequestHandler;
  secureCookies?: boolean;
} = {}) => {
  const router = Router();
  const secureCookies = options.secureCookies ?? process.env.NODE_ENV === 'production';
  router.use(options.access || localAccountAccess);
  router.use(createAuthRateLimit());

  router.post('/register', async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email);
      const password = readPassword(request.body?.password);
      const database = await getDatabase();
      const exists = database.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (exists) throw jsonError('该邮箱已注册，请直接登录', 409);
      const now = Date.now();
      const id = randomUUID();
      const role = 'member';
      const passwordHash = await hashPassword(password);
      const sessionId = randomBytes(32).toString('hex');
      withTransaction(database, () => {
        // Recheck after the asynchronous KDF so concurrent registrations cannot bypass uniqueness.
        if (database.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
          throw jsonError('该邮箱已注册，请直接登录', 409);
        }
        database.prepare(
          'INSERT INTO users(id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(id, email, passwordHash, role, now, now);
        database.prepare('INSERT INTO sessions(id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
          .run(sessionHash(sessionId), id, now + SESSION_DAYS * 24 * 60 * 60 * 1000, now);
      });
      response.setHeader('Set-Cookie', cookie(sessionId, SESSION_DAYS * 24 * 60 * 60, secureCookies));
      response.status(201).json({ user: { id, email, role, createdAt: now } satisfies AuthUser });
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email);
      const password = readPassword(request.body?.password);
      const database = await getDatabase();
      const row = database.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
      const passwordMatches = await verifyPassword(password, row ? String(row.password_hash) : dummyPasswordHash);
      if (!row || !passwordMatches) throw jsonError('邮箱或密码不正确', 401);
      const now = Date.now();
      const sessionId = randomBytes(32).toString('hex');
      database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
      database.prepare('INSERT INTO sessions(id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
        .run(sessionHash(sessionId), String(row.id), now + SESSION_DAYS * 24 * 60 * 60 * 1000, now);
      const previousSession = parseCookies(request.headers.cookie)[SESSION_COOKIE];
      if (previousSession) database.prepare('DELETE FROM sessions WHERE id = ?').run(sessionHash(previousSession));
      response.setHeader('Set-Cookie', cookie(sessionId, SESSION_DAYS * 24 * 60 * 60, secureCookies));
      response.json({ user: mapUser(row) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', async (request, response, next) => {
    try {
      const database = await getDatabase();
      response.json({ user: findUserBySession(database, parseCookies(request.headers.cookie)[SESSION_COOKIE]) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', async (request, response, next) => {
    try {
      const database = await getDatabase();
      const sessionId = parseCookies(request.headers.cookie)[SESSION_COOKIE];
      if (sessionId) database.prepare('DELETE FROM sessions WHERE id = ?').run(sessionHash(sessionId));
      response.setHeader('Set-Cookie', cookie('', 0, secureCookies));
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.use((error: Error & { status?: number }, _request: unknown, response: { status: (code: number) => { json: (body: unknown) => void } }, _next: unknown) => {
    response.status(error.status || 500).json({ error: error.status ? error.message : '账户服务暂时不可用' });
  });

  return router;
};
