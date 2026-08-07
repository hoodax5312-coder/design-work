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
    const endpointSuffix = /\/(?:response|responses|models|messages|chat\/completions|images(?:\/360ai)?\/generations|video\/generations)$/;
    url.pathname = url.pathname.replace(endpointSuffix, '');
    if (url.pathname === '' || url.pathname === '/') {
      url.pathname = '/v1';
    }
    return withoutTrailingSlash(url.toString());
  } catch {
    return normalized;
  }
};
