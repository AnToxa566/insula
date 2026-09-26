import { refreshAccessToken } from '../hydration/refresh';
import { getAccessToken } from '../session/session-store';
import { isApiClientError } from './api-client-error';
import { rawRequest, type RawRequestOptions } from './raw-request';

export type RequestOptions = Omit<RawRequestOptions, 'headers'> & { headers?: HeadersInit };

// The only way app code should reach the API for anything past login/
// register — it attaches the current access token and, on a single 401,
// refreshes once and retries transparently. Never call rawRequest()
// directly from app code.
async function authorizedRequest<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const attempt = () => rawRequest<T>(method, path, { ...options, headers: withAuthHeader(options.headers) });

  try {
    return await attempt();
  } catch (error) {
    if (isApiClientError(error) && error.kind === 'http' && error.status === 401) {
      // Throws ApiClientError('refresh-failed') on failure — propagates
      // as-is, no retry, no loop.
      await refreshAccessToken(getAccessToken());
      return attempt();
    }
    throw error;
  }
}

function withAuthHeader(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  const accessToken = getAccessToken();
  if (accessToken) {
    merged.set('Authorization', `Bearer ${accessToken}`);
  }
  return merged;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => authorizedRequest<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    authorizedRequest<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    authorizedRequest<T>('PUT', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => authorizedRequest<T>('DELETE', path, options),
};
