import {
  LoginSchema,
  LogoutSchema,
  RegisterSchema,
  type AuthUser,
  type LoginInput,
  type LoginResponse,
  type RegisterInput,
  type RegisterResponse,
} from '@insula/contracts';

import { clearSession, getRefreshToken, setSession } from '../session/session-store';
import { apiClient } from './api-client';
import { rawRequest } from './raw-request';

// Register/login/refresh legitimately run before a session exists, so they
// hit rawRequest() directly instead of apiClient — there is no token to
// attach yet, and attaching a stale one would just produce a spurious 401.
export async function register(input: RegisterInput): Promise<RegisterResponse> {
  const session = await rawRequest<RegisterResponse>('POST', '/auth/register', {
    body: RegisterSchema.parse(input),
  });
  setSession(session);
  return session;
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  const session = await rawRequest<LoginResponse>('POST', '/auth/login', { body: LoginSchema.parse(input) });
  setSession(session);
  return session;
}

// Reads the refresh token from the store itself rather than taking it as a
// parameter — callers never handle a token directly. Always clears the
// local session, even if the revoke call fails, so logout leaves the user
// signed out regardless of network conditions; the server endpoint is
// idempotent for the same reason.
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await rawRequest<void>('POST', '/auth/logout', { body: LogoutSchema.parse({ refreshToken }) });
    }
  } finally {
    clearSession();
  }
}

// The only endpoint that requires an existing session, so it goes through
// apiClient and gets the 401-refresh-retry behavior for free.
export function me(): Promise<AuthUser> {
  return apiClient.get<AuthUser>('/auth/me');
}
