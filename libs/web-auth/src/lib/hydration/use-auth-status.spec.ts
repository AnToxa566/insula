import { renderHook, waitFor } from '@testing-library/react';
import type { AuthUser, LoginResponse } from '@insula/contracts';

import { __resetWebAuthConfigForTests, configureWebAuth } from '../config';
import { useAuthStore } from '../session/session-store';
import { __resetHydrationForTests } from './hydrate-session';
import { useAuthStatus } from './use-auth-status';

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

describe('useAuthStatus', () => {
  afterEach(() => {
    __resetWebAuthConfigForTests();
    __resetHydrationForTests();
    resetStore();
  });

  it('settles on anonymous when nothing is persisted', async () => {
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl: jest.fn() });

    const { result } = renderHook(() => useAuthStatus());

    await waitFor(() => expect(result.current).toBe('anonymous'));
  });

  it('triggers exactly one refresh even when multiple components mount the hook at once', async () => {
    localStorage.setItem(
      'insula:auth',
      JSON.stringify({ state: { user, refreshToken: 'valid-refresh' }, version: 0 }),
    );
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        fakeResponse(200, { accessToken: 'fresh-token', refreshToken: 'rotated', user } satisfies LoginResponse),
      );
    configureWebAuth({ baseUrl: 'https://api.test', fetchImpl });

    renderHook(() => useAuthStatus());
    renderHook(() => useAuthStatus());
    const { result } = renderHook(() => useAuthStatus());

    await waitFor(() => expect(result.current).toBe('authenticated'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
