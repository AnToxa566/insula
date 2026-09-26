export type ApiClientErrorKind = 'network' | 'timeout' | 'http' | 'refresh-failed';

export interface ApiClientErrorOptions {
  status?: number;
  body?: unknown;
  cause?: unknown;
}

// Every failure this lib produces collapses to one of these four kinds,
// never a raw fetch/TypeError — callers branch on `kind` (and `status` for
// 'http') to show distinct UI without inspecting a stack trace.
export class ApiClientError extends Error {
  readonly kind: ApiClientErrorKind;
  readonly status?: number;
  readonly body?: unknown;
  override readonly cause?: unknown;

  private constructor(kind: ApiClientErrorKind, message: string, options: ApiClientErrorOptions = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.kind = kind;
    this.status = options.status;
    this.body = options.body;
    this.cause = options.cause;
  }

  static network(cause: unknown): ApiClientError {
    return new ApiClientError('network', 'Network request failed', { cause });
  }

  static timeout(): ApiClientError {
    return new ApiClientError('timeout', 'Request timed out');
  }

  static http(status: number, body: unknown): ApiClientError {
    return new ApiClientError('http', `Request failed with status ${status}`, { status, body });
  }

  static refreshFailed(cause: unknown): ApiClientError {
    return new ApiClientError('refresh-failed', 'Session refresh failed', { cause });
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}
