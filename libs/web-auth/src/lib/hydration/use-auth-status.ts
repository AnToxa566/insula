import { useEffect } from 'react';

import { useAuthStore, type AuthStatus } from '../session/session-store';
import { hydrateSession } from './hydrate-session';

// The one hook the app needs to gate rendering on session readiness. Kicks
// off hydration exactly once — hydrateSession() is itself idempotent — no
// matter how many components call this hook or how many times effects
// re-run under StrictMode.
export function useAuthStatus(): AuthStatus {
  useEffect(() => {
    void hydrateSession();
  }, []);
  return useAuthStore((state) => state.status);
}
