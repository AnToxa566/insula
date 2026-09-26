import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthUser, LoginResponse } from '@insula/contracts';

export type AuthStatus = 'idle' | 'hydrating' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setStatus: (status: AuthStatus) => void;
  setSession: (session: LoginResponse) => void;
  clearSession: () => void;
}

// `partialize` is what keeps the access token off disk: only `user` and
// `refreshToken` survive to localStorage; `accessToken` and `status` are
// in-memory only. `skipHydration` is required because this module can be
// imported during Next.js SSR (no `localStorage` there) — hydration is
// triggered explicitly, client-side only, from hydration/hydrate-session.ts.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      status: 'idle',
      user: null,
      accessToken: null,
      refreshToken: null,
      setStatus: (status) => set({ status }),
      setSession: (session) =>
        set({
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          status: 'authenticated',
        }),
      clearSession: () => set({ user: null, accessToken: null, refreshToken: null, status: 'anonymous' }),
    }),
    {
      name: 'insula:auth',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ user: state.user, refreshToken: state.refreshToken }),
    },
  ),
);

// Plain, non-hook accessors. Only client/ and hydration/ import these — the
// public hooks below never expose a token, which is what makes "no
// component reads tokens directly from storage" hold.
export const getAccessToken = (): string | null => useAuthStore.getState().accessToken;
export const getRefreshToken = (): string | null => useAuthStore.getState().refreshToken;
export const setSession = (session: LoginResponse): void => useAuthStore.getState().setSession(session);
export const clearSession = (): void => useAuthStore.getState().clearSession();
export const setAuthStatus = (status: AuthStatus): void => useAuthStore.getState().setStatus(status);

// Public hooks — the only way a component may read session state.
export const useAuthUser = (): AuthUser | null => useAuthStore((state) => state.user);
export const useIsAuthenticated = (): boolean => useAuthStore((state) => state.status === 'authenticated');
