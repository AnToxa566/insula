import type { AuthUser, LoginResponse } from '@insula/contracts';

import { __resetWebAuthConfigForTests, configureWebAuth } from '../config';
import { useAuthStore } from '../session/session-store';
import { __resetHydrationForTests, hydrateSession } from './hydrate-session';

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

function seedPersistedSession(refreshToken: string): void {
  localStorage.setItem('insula:auth', JSON.stringify({ state: { user, refreshToken }, version: 0 }));
}

describe('hydrateSession', () => {
  afterEach(() => {
    __resetWebAuthConfigForTests();
    __resetHydrationForTests();
    resetStore();
  });

  it('goes straight to anonymous when nothing is persisted', async () => {
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl: jest.fn() });

    await hydrateSession();

    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('silently refreshes and lands on authenticated when a refresh token is persisted', async () => {
    seedPersistedSession('valid-refresh');
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        fakeResponse(200, { accessToken: 'fresh-token', refreshToken: 'rotated', user } satisfies LoginResponse),
      );
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    await hydrateSession();

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('lands on anonymous if the persisted refresh token is revoked, without throwing', async () => {
    seedPersistedSession('revoked-refresh');
    const fetchImpl = jest.fn().mockResolvedValue(fakeResponse(401, {}));
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    await expect(hydrateSession()).resolves.toBeUndefined();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('only runs once no matter how many times it is called', async () => {
    seedPersistedSession('valid-refresh');
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        fakeResponse(200, { accessToken: 'fresh-token', refreshToken: 'rotated', user } satisfies LoginResponse),
      );
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    await Promise.all([hydrateSession(), hydrateSession(), hydrateSession()]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
