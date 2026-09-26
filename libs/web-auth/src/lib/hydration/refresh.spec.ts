import type { AuthUser, LoginResponse } from '@insula/contracts';

import { __resetWebAuthConfigForTests, configureWebAuth } from '../config';
import { setSession, useAuthStore } from '../session/session-store';
import { refreshAccessToken } from './refresh';

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

describe('refreshAccessToken — single-flight mutex', () => {
  afterEach(() => {
    __resetWebAuthConfigForTests();
    resetStore();
  });

  it('dedupes N concurrent same-tab callers into exactly one network call', async () => {
    useAuthStore.setState({ status: 'idle', user, accessToken: null, refreshToken: 'valid-refresh' }, false);

    let calls = 0;
    const fetchImpl = jest.fn(async () => {
      calls++;
      const session: LoginResponse = { accessToken: 'fresh-token', refreshToken: 'rotated', user };
      return fakeResponse(200, session);
    });
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    const tokens = await Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()]);

    expect(tokens).toEqual(['fresh-token', 'fresh-token', 'fresh-token']);
    expect(calls).toBe(1);
  });

  it('short-circuits without a network call if an access token already exists (e.g. delivered by a sibling tab)', async () => {
    setSession({ accessToken: 'already-fresh', refreshToken: 'valid-refresh', user });

    const fetchImpl = jest.fn();
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    await expect(refreshAccessToken()).resolves.toBe('already-fresh');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('on refresh failure, clears the session, fires onSessionExpired, and leaves the mutex free for the next attempt', async () => {
    useAuthStore.setState({ accessToken: null, refreshToken: 'revoked-refresh', user, status: 'idle' });

    let sessionExpiredCalls = 0;
    const fetchImpl = jest.fn().mockResolvedValue(fakeResponse(401, {}));
    configureWebAuth({
      baseUrl: 'https://api.test',
      fetchImpl,
      onSessionExpired: () => {
        sessionExpiredCalls++;
      },
    });

    await expect(refreshAccessToken()).rejects.toMatchObject({ kind: 'refresh-failed' });
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(sessionExpiredCalls).toBe(1);

    // Mutex was cleared after the failure — a later attempt tries again
    // rather than replaying the same rejection forever.
    useAuthStore.setState({ refreshToken: 'another-refresh' });
    fetchImpl.mockResolvedValueOnce(
      fakeResponse(200, { accessToken: 'second-token', refreshToken: 'r2', user } satisfies LoginResponse),
    );
    await expect(refreshAccessToken()).resolves.toBe('second-token');
  });

  it('throws refresh-failed immediately when there is no refresh token to use', async () => {
    resetStore();
    const fetchImpl = jest.fn();
    let sessionExpiredCalls = 0;
    configureWebAuth({
      baseUrl: 'https://api.test',
      fetchImpl,
      onSessionExpired: () => {
        sessionExpiredCalls++;
      },
    });

    await expect(refreshAccessToken()).rejects.toMatchObject({ kind: 'refresh-failed' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(sessionExpiredCalls).toBe(1);
  });
});
