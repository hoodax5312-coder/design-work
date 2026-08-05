import type { ProviderProtocol } from '../stores/useProviderStore';

const withoutTrailingSlash = (value: string) => value.trim().replace(/\/+$/, '');

export const normalizeProviderBaseUrl = (
  protocol: ProviderProtocol,
  value: string,
) => {
  const normalized = withoutTrailingSlash(value);
  if (protocol === 'anthropic-messages' || !normalized) return normalized;

  try {
    const url = new URL(normalized);
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/v1';
      return withoutTrailingSlash(url.toString());
    }
  } catch {
    return normalized;
  }

  return normalized;
};
