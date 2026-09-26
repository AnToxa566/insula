import { getAccessToken, getRefreshToken, setAuthStatus, useAuthStore } from '../session/session-store';
import { refreshAccessToken } from './refresh';

// Guards against React StrictMode's double-invoked effects and multiple
// useAuthStatus() consumers all kicking off hydration at once.
let started = false;

// Runs once per tab, on app start: loads the persisted refresh token and
// user, then — if there's no in-memory access token — silently refreshes
// once before the app is considered ready. This is what stops a page reload
// from looking like a logout.
export async function hydrateSession(): Promise<void> {
  if (started) return;
  started = true;

  await useAuthStore.persist.rehydrate();

  if (getAccessToken()) {
    setAuthStatus('authenticated');
    return;
  }
  if (!getRefreshToken()) {
    setAuthStatus('anonymous');
    return;
  }

  setAuthStatus('hydrating');
  try {
    await refreshAccessToken();
    setAuthStatus('authenticated');
  } catch {
    // refreshAccessToken() already cleared the session and fired onSessionExpired.
    setAuthStatus('anonymous');
  }
}

// Test-only: reset module state between specs.
export function __resetHydrationForTests(): void {
  started = false;
}
