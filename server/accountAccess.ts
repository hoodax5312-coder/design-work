import type { RequestHandler } from 'express';

export const createAccountAccess = (publicOrigin: string): RequestHandler => {
  const expected = new URL(publicOrigin);
  if (expected.protocol !== 'https:' || expected.origin !== publicOrigin) {
    throw new Error('LIZUO_PUBLIC_ORIGIN 必须为不带路径的 HTTPS 来源');
  }
  return (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (request.get('host') !== expected.host
      || (request.get('origin') !== undefined && request.get('origin') !== expected.origin)
      || request.get('sec-fetch-site') === 'cross-site') {
      response.status(403).json({ error: '账户请求来源不受信任' });
      return;
    }
    next();
  };
};

// The limit is intentionally process-local; deployments must run a single account instance.
export const createAuthRateLimit = (): RequestHandler => {
  const attempts = new Map<string, { count: number; reset: number }>();
  return (request, response, next) => {
    if (request.method !== 'POST' || !['/login', '/register'].includes(request.path)) return next();
    const now = Date.now();
    for (const [key, value] of attempts) if (value.reset <= now) attempts.delete(key);
    const registration = request.path === '/register';
    const key = `${request.ip}:${request.path}`;
    const entry = attempts.get(key);
    const limit = registration ? 5 : 30;
    if ((!entry && attempts.size >= 10000) || (entry && entry.count >= limit)) {
      response.set('Retry-After', String(Math.ceil(((entry?.reset || now + 60000) - now) / 1000)));
      response.status(429).json({ error: '操作过于频繁，请稍后再试' });
      return;
    }
    attempts.set(key, { count: (entry?.count || 0) + 1, reset: entry?.reset || now + (registration ? 3600000 : 900000) });
    next();
  };
};
