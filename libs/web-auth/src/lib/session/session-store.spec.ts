import type { AuthUser, LoginResponse } from '@insula/contracts';

import { clearSession, getAccessToken, getRefreshToken, setSession, useAuthStore } from './session-store';

const user: AuthUser = {
  id: 'user-1',
  email: 'a@example.com',
  profile: { id: 'profile-1', handle: 'a', displayName: 'A', avatarSeed: 'seed', type: 'USER' },
};

const session: LoginResponse = { accessToken: 'access-1', refreshToken: 'refresh-1', user };

function resetStore(): void {
  useAuthStore.setState(
    { status: 'idle', user: null, accessToken: null, refreshToken: null },
    false,
  );
  localStorage.clear();
}

describe('session-store', () => {
  afterEach(() => {
    resetStore();
  });

  it('setSession populates user/accessToken/refreshToken and flips status to authenticated', () => {
    setSession(session);

    expect(getAccessToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('refresh-1');
    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('clearSession resets everything and flips status to anonymous', () => {
    setSession(session);
    clearSession();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('persists only user and refreshToken to localStorage — never the access token or status', () => {
    setSession(session);

    const raw = localStorage.getItem('insula:auth');
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string);

    expect(persisted.state).toEqual({ user, refreshToken: 'refresh-1' });
    expect(persisted.state.accessToken).toBeUndefined();
    expect(persisted.state.status).toBeUndefined();
  });
});
