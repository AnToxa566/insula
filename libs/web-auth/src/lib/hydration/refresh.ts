import { RefreshSchema, type LoginResponse } from '@insula/contracts';

import { ApiClientError } from '../client/api-client-error';
import { rawRequest } from '../client/raw-request';
import { getOnSessionExpired } from '../config';
import { clearSession, getAccessToken, getRefreshToken, setSession, useAuthStore } from '../session/session-store';

const LOCK_NAME = 'insula:auth-refresh';
const BROADCAST_CHANNEL_NAME = 'insula:auth-session';

type BroadcastMessage = { type: 'session'; session: LoginResponse } | { type: 'cleared' };

// Shares a freshly-minted session with sibling tabs the instant this tab
// obtains one, so a tab that's queued behind the lock below can often pick
// it up without making its own redundant /auth/refresh call. The message is
// a transient postMessage, never written to disk — it doesn't reintroduce
// the "access token persisted" risk `partialize` avoids in session-store.ts.
//
// This is an optimization, not the correctness guarantee: the lock plus the
// re-check in attemptRefresh() below are what actually prevent a revoked
// refresh token from ever being reused, whether or not this message arrives
// in time. Without it, a losing tab still safely re-reads the (by then
// already-rotated) refresh token instead of the stale one it started with.
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BROADCAST_CHANNEL_NAME) : null;

channel?.addEventListener('message', (event: MessageEvent<BroadcastMessage>) => {
  if (event.data.type === 'session') {
    setSession(event.data.session);
  } else {
    clearSession();
  }
});

// In-process promise mutex: dedupes concurrent same-tab callers. Cleared in
// `finally` so a later 401 (after a fresh failure) is free to try again.
let inFlight: Promise<string> | null = null;

// The one place a refresh happens — shared by the 401-interceptor
// (client/api-client.ts) and app-start hydration (hydrate-session.ts), so
// the single-flight/cross-tab logic exists exactly once.
//
// `staleToken` is the access token whose 401 triggered this call (undefined
// for the hydration path, which has no token to begin with). It's what lets
// the "someone already refreshed this" shortcut below tell "the store holds
// a fresh token a sibling tab just delivered" apart from "the store still
// holds the same expired token that got us here" — a blind truthiness check
// would treat the second case as already-fresh and skip refreshing entirely.
export function refreshAccessToken(staleToken?: string | null): Promise<string> {
  if (!inFlight) {
    inFlight = runExclusive(staleToken).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runExclusive(staleToken?: string | null): Promise<string> {
  // A sibling tab's broadcast may have already delivered a fresh token —
  // skip the lock entirely if so.
  const current = getAccessToken();
  if (current && current !== staleToken) return current;

  // navigator.locks dedupes *across tabs* — an in-memory promise can't reach
  // another tab's JS heap. Falls back to running directly if the API is
  // unavailable; the in-process mutex above still applies in that case.
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
    return navigator.locks.request(LOCK_NAME, () => attemptRefresh(staleToken));
  }
  return attemptRefresh(staleToken);
}

async function attemptRefresh(staleToken?: string | null): Promise<string> {
  // Re-check right after acquiring the lock: a sibling tab may have finished
  // its own refresh (and broadcast it) while we were queued.
  const current = getAccessToken();
  if (current && current !== staleToken) {
    return current;
  }

  // Re-read persisted state before using it: another tab may have already
  // rotated the refresh token. Presenting that stale value instead of the
  // current one is exactly the "reuse" the backend revokes every session for.
  await useAuthStore.persist.rehydrate();
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSession();
    getOnSessionExpired()();
    throw ApiClientError.refreshFailed(new Error('No refresh token available'));
  }

  try {
    const session = await rawRequest<LoginResponse>('POST', '/auth/refresh', {
      body: RefreshSchema.parse({ refreshToken }),
    });
    setSession(session);
    channel?.postMessage({ type: 'session', session } satisfies BroadcastMessage);
    return session.accessToken;
  } catch (error) {
    clearSession();
    channel?.postMessage({ type: 'cleared' } satisfies BroadcastMessage);
    getOnSessionExpired()();
    throw ApiClientError.refreshFailed(error);
  }
}
