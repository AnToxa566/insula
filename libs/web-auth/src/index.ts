export { configureWebAuth } from './lib/config';

export { ApiClientError, isApiClientError } from './lib/client/api-client-error';
export type { ApiClientErrorKind } from './lib/client/api-client-error';
export { extractErrorMessage } from './lib/client/error-message';

export { apiClient } from './lib/client/api-client';
export { login, logout, me, register, registerQuick } from './lib/client/auth-endpoints';

export { useAuthUser, useIsAuthenticated } from './lib/session/session-store';
export type { AuthStatus } from './lib/session/session-store';

export { useAuthStatus } from './lib/hydration/use-auth-status';
