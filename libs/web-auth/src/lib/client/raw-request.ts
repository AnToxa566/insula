import { getBaseUrl, getFetchImpl } from '../config';
import { ApiClientError } from './api-client-error';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface RawRequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  timeoutMs?: number;
}

// The only place a fetch() call exists in this lib. No auth header, no 401
// handling — those live one layer up in api-client.ts, which is what lets
// the 401-refresh-retry logic call this function again for the retry
// without re-triggering itself. Never logs the request (so a token attached
// by the caller via `headers` never reaches a log line).
export async function rawRequest<T>(
  method: string,
  path: string,
  options: RawRequestOptions = {},
): Promise<T> {
  // `new Headers(init)` is the only correct way to merge an arbitrary
  // HeadersInit — spreading a Headers instance into an object literal drops
  // its entries silently, since they aren't own enumerable properties.
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await getFetchImpl()(`${getBaseUrl()}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw ApiClientError.timeout();
    }
    throw ApiClientError.network(error);
  }

  if (!response.ok) {
    throw ApiClientError.http(response.status, await safeParseJson(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await safeParseJson(response)) as T;
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
