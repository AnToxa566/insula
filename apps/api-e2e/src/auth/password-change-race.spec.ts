import axios, { isAxiosError } from 'axios';
import { createHash } from 'node:crypto';
import { prisma } from '@insula/db';

import {
  cleanupPwresetUsers,
  forceResetToken,
  PWRESET_NEW_PASSWORD,
  registerPwresetUser,
} from '../support/password-reset-helpers';
import { authHeader } from '../support/social-helpers';

// ---------------------------------------------------------------------------
// "Revoke all refresh tokens" must really mean all of them, even for tokens
// being created at the very moment the password changes. The two creators that
// can overlap a password change are POST /auth/refresh (mints a successor) and
// POST /auth/login (bcrypt-compares for ~250 ms, THEN inserts a token). The
// server serialises them against the change with a FOR SHARE lock on the user
// row (see lockUserRowShared); these tests hammer that from outside.
//
// Each iteration: register a user (one live token), then run the password
// change while, in parallel, a refresh chain (each call uses the token the
// previous one returned) and a stream of logins with the OLD password keep
// firing. After the change has committed and every in-flight call has settled,
// the database is asked directly for live refresh_tokens rows of that user.
//
// Per-IP budget spent by this file (limits per 15 min, shared with
// password-reset.spec.ts — see the tally at the top of that file):
//   confirm: 6 (one per confirm iteration)   request/verify: 0
// The reset token is planted with forceResetToken() (a hash written via
// Prisma, as /verify would), so no /verify budget is used. change-password is
// limited per user (5 / 15 min), one call per user here. register, login and
// refresh have no rate limit.
// ---------------------------------------------------------------------------

jest.setTimeout(60_000);

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CONFIRM_ITERATIONS = 6;
const CHANGE_ITERATIONS = 3;
// Old-password logins per iteration, LOGIN_INTERVAL_MS apart. Each costs a
// bcrypt compare (~250 ms on the API's 4-thread pool) and the API is shared
// with the other suites running in parallel workers, so this stays small:
// spread over ~300 ms their compares finish just before, during and just
// after the password change commits, which is the window that matters.
const LOGINS_PER_ITERATION = 5;
const LOGIN_INTERVAL_MS = 60;

const isUnauthorized = (err: unknown) => isAxiosError(err) && err.response?.status === 401;

// Runs `change` (the password change) while a refresh chain and a stream of
// old-password logins race it. Resolves with the change's result once the
// change and every racing call have settled. Unexpected errors (anything but a
// 401) fail the test.
async function raceAgainst<T>(
  who: { email: string; password: string; refreshToken: string },
  change: () => Promise<T>,
): Promise<T> {
  let changeDone = false;

  const refreshChain = (async () => {
    let token = who.refreshToken;
    // Keep refreshing until the change has committed (plus a couple more
    // attempts after, which must all be refused).
    let after = 0;
    while (after < 2) {
      try {
        const res = await axios.post('/api/auth/refresh', { refreshToken: token });
        token = res.data.refreshToken;
      } catch (err) {
        if (!isUnauthorized(err)) throw err;
        // Revoked by the change (or a lost claim): this chain is over.
        return;
      }
      if (changeDone) after += 1;
      await sleep(5);
    }
  })();

  const logins: Promise<unknown>[] = [];
  const loginStream = (async () => {
    for (let i = 0; i < LOGINS_PER_ITERATION; i += 1) {
      logins.push(
        axios
          .post('/api/auth/login', { email: who.email, password: who.password })
          .catch((err: unknown) => {
            if (!isUnauthorized(err)) throw err;
          }),
      );
      await sleep(LOGIN_INTERVAL_MS);
    }
  })();

  // Start the change a moment after the racers so they are already in flight.
  await sleep(40);
  let result: T;
  try {
    result = await change();
  } finally {
    changeDone = true;
  }

  await Promise.all([refreshChain, loginStream, ...logins]);
  return result;
}

async function liveTokens(userId: string) {
  return prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { tokenHash: true },
  });
}

describe('password change vs concurrent token creation', () => {
  afterAll(async () => {
    await cleanupPwresetUsers('race');
    await prisma.$disconnect();
  });

  it.each(Array.from({ length: CONFIRM_ITERATIONS }, (_, i) => i + 1))(
    'reset confirm #%i leaves no live refresh token, whatever refresh/login raced it',
    async () => {
      const { identity, data } = await registerPwresetUser('race');
      const resetToken = await forceResetToken(identity.email);

      const confirmed = await raceAgainst(
        { email: identity.email, password: identity.password, refreshToken: data.refreshToken },
        () =>
          axios.post('/api/auth/password-reset/confirm', {
            resetToken,
            newPassword: PWRESET_NEW_PASSWORD,
          }),
      );
      expect(confirmed.status).toBe(204);

      // Every token issued before the reset committed — the registration one,
      // every refresh successor, every old-password login — is revoked.
      expect(await liveTokens(data.user.id)).toEqual([]);
      // And the old password is dead for good.
      await expect(
        axios.post('/api/auth/login', { email: identity.email, password: identity.password }),
      ).rejects.toMatchObject({ response: { status: 401 } });
    },
  );

  it.each(Array.from({ length: CHANGE_ITERATIONS }, (_, i) => i + 1))(
    'authenticated password change #%i leaves only its own fresh token live',
    async () => {
      const { identity, data } = await registerPwresetUser('race');

      const changed = await raceAgainst(
        { email: identity.email, password: identity.password, refreshToken: data.refreshToken },
        () =>
          axios.post(
            '/api/auth/change-password',
            { currentPassword: identity.password, newPassword: PWRESET_NEW_PASSWORD },
            authHeader(data.accessToken),
          ),
      );
      expect(changed.status).toBe(200);

      // Nothing but the session the change itself handed back may be live.
      // (It may be gone too: a racing refresh that read one of the by-now
      // revoked tokens after the commit trips reuse detection, which by design
      // revokes every session of the user. That is allowed; a survivor is not.)
      const live = await liveTokens(data.user.id);
      const own = sha256(changed.data.refreshToken);
      expect(live.filter((t) => t.tokenHash !== own)).toEqual([]);
    },
  );
});
