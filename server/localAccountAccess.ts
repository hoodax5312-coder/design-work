import type { RequestHandler } from 'express';

// These accounts belong to the local workspace, not a public multi-tenant service.
export const localAccountAccess: RequestHandler = (request, response, next) => {
  response.set('Cache-Control', 'no-store');
  const host = request.get('host') || '';
  try {
    const hostname = new URL(`http://${host}`).hostname;
    const origin = request.get('origin');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname)
      || (origin !== undefined && new URL(origin).origin !== `${request.protocol}://${host}`)
      || request.get('sec-fetch-site') === 'cross-site') {
      throw new Error('non-local request');
    }
  } catch {
    response.status(403).json({ error: '本地账户服务仅允许本机同源访问' });
    return;
  }
  next();
};
