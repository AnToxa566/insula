import type { AuthUser, LoginResponse } from '@insula/contracts';

import { __resetWebAuthConfigForTests, configureWebAuth } from '../config';
import { setSession, useAuthStore } from '../session/session-store';
import { apiClient } from './api-client';

const user: AuthUser = {
  id: 'user-1',
  email: 'a@example.com',
  profile: { id: 'profile-1', handle: 'a', displayName: 'A', avatarSeed: 'seed', type: 'USER' },
};

function fakeResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function resetStore(): void {
  useAuthStore.setState({ status: 'idle', user: null, accessToken: null, refreshToken: null }, false);
  localStorage.clear();
}

describe('apiClient — 401 → single-flight refresh → retry', () => {
  afterEach(() => {
    __resetWebAuthConfigForTests();
    resetStore();
  });

  it('refreshes exactly once for 3 concurrent requests against an expired access token, and all 3 succeed', async () => {
    setSession({ accessToken: 'expired-token', refreshToken: 'valid-refresh', user });

    let refreshCalls = 0;
    const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++;
        const session: LoginResponse = { accessToken: 'fresh-token', refreshToken: 'rotated-refresh', user };
        return fakeResponse(200, session);
      }
      if (url.endsWith('/protected')) {
        const auth = new Headers(init?.headers).get('Authorization');
        return auth === 'Bearer fresh-token' ? fakeResponse(200, { ok: true }) : fakeResponse(401, {});
      }
      throw new Error(`unexpected url: ${url}`);
    });
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    const results = await Promise.all([
      apiClient.get('/protected'),
      apiClient.get('/protected'),
      apiClient.get('/protected'),
    ]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
  });

  it('a revoked refresh token produces a clean logout for all callers, not a retry loop', async () => {
    setSession({ accessToken: 'expired-token', refreshToken: 'revoked-refresh', user });

    let refreshCalls = 0;
    let sessionExpiredCalls = 0;
    const fetchImpl = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshCalls++;
        return fakeResponse(401, {});
      }
      if (url.endsWith('/protected')) {
        return fakeResponse(401, {});
      }
      throw new Error(`unexpected url: ${url}`);
    });
    configureWebAuth({
      baseUrl: 'https://api.test',
      fetchImpl,
      onSessionExpired: () => {
        sessionExpiredCalls++;
      },
    });

    const outcomes = await Promise.allSettled([
      apiClient.get('/protected'),
      apiClient.get('/protected'),
      apiClient.get('/protected'),
    ]);

    expect(outcomes.every((outcome) => outcome.status === 'rejected')).toBe(true);
    for (const outcome of outcomes) {
      expect(outcome.status).toBe('rejected');
      if (outcome.status === 'rejected') {
        expect(outcome.reason.kind).toBe('refresh-failed');
      }
    }
    // Exactly one refresh attempt across all 3 callers — no retry loop.
    expect(refreshCalls).toBe(1);
    expect(sessionExpiredCalls).toBe(1);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('surfaces network failure and 500 distinctly from a 401', async () => {
    setSession({ accessToken: 'valid-token', refreshToken: 'valid-refresh', user });

    const fetchImpl = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/flaky-network')) throw new TypeError('Failed to fetch');
      if (url.endsWith('/flaky-server')) return fakeResponse(500, { message: 'boom' });
      throw new Error(`unexpected url: ${url}`);
    });
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    await expect(apiClient.get('/flaky-network')).rejects.toMatchObject({ kind: 'network' });
    await expect(apiClient.get('/flaky-server')).rejects.toMatchObject({ kind: 'http', status: 500 });
  });
});
