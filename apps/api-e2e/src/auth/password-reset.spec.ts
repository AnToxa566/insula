import axios, { isAxiosError, type AxiosResponse } from 'axios';
import { prisma } from '@insula/db';

import {
  cleanupPwresetUsers,
  expireCode,
  expireToken,
  forceKnownCode,
  getResetRow,
  KNOWN_CODE,
  PWRESET_NEW_PASSWORD,
  registerPwresetUser,
  unknownPwresetEmail,
  WRONG_CODE,
} from '../support/password-reset-helpers';

// ---------------------------------------------------------------------------
// Per-IP call budget. Every e2e request comes from one address (::1) into one
// API process, and the in-memory per-IP counters are shared by everything that
// runs against it and are never reset mid-run. Limits (per 15 min) and what
// THIS suite spends (429s count too):
//
//                     limit   spent
//   request             20      7   happy 1 + identical 2 + cooldown 2 + slow 2
//   verify              30     14   happy 2 + expired 1 + lockout 7 + expiredTok 1
//                                   + concurrent 1 + slow 2
//   confirm             20      8   happy 2 + expiredTok 2 + concurrent 2 + slow 2
//
// Other suites that draw on the same per-IP counters:
//   password-change-race.spec.ts: confirm 6 (one per race iteration; its
//     reset tokens are planted via forceResetToken(), so 0 verify, 0 request).
//   apps/api/src/auth/password-reset.service.db.spec.ts: 0 (calls the service
//     in-process; run via the `@insula/api:test-db` target, not an e2e suite).
//   change-password.spec.ts does not touch these endpoints.
// Run total: request 7/20, verify 14/30, confirm 14/20. If you add confirm
// calls anywhere, keep the sum of all suites below 20.
//
// A rerun starts from zero: `nx e2e` depends on `@insula/api:serve`, which
// boots a fresh API process each run (nothing listens on API_PORT
// beforehand, and global-teardown stops it), so the counters are new too. If
// you instead point the suite at an API you started by hand and rerun within
// 15 minutes, the counters carry over — restart it.
//
// Shortcuts that keep the budget down (each documented where used):
//  - forceKnownCode() upserts the reset row, so tests that aren't about
//    /request itself don't spend a request call;
//  - one fresh email per test that calls /request or /verify, because the
//    per-email throttlers (request: 1/60s + 5/h; verify: 10/15min) are also
//    in-memory and keyed on the normalized email.
// ---------------------------------------------------------------------------

jest.setTimeout(30_000);

const INVALID_CODE = 'Invalid or expired code';
const INVALID_TOKEN = 'Invalid or expired reset token';

async function errorResponse(call: Promise<AxiosResponse>): Promise<AxiosResponse> {
  try {
    await call;
  } catch (err) {
    if (isAxiosError(err) && err.response) return err.response;
    throw err;
  }
  throw new Error('expected the request to be rejected, but it succeeded');
}

const requestCode = (email: string) => axios.post('/api/auth/password-reset/request', { email });
const verify = (email: string, code: string) =>
  axios.post('/api/auth/password-reset/verify', { email, code });
const confirm = (resetToken: string, newPassword: string) =>
  axios.post('/api/auth/password-reset/confirm', { resetToken, newPassword });
const login = (email: string, password: string) =>
  axios.post('/api/auth/login', { email, password });

async function verifyForToken(email: string): Promise<string> {
  const res = await verify(email, KNOWN_CODE);
  expect(res.status).toBe(200);
  return res.data.resetToken;
}

describe('password reset', () => {
  afterAll(async () => {
    await cleanupPwresetUsers('reset');
    await prisma.$disconnect();
  });

  it('resets the password end to end and revokes every earlier session', async () => {
    const { identity, data } = await registerPwresetUser('reset');

    const requested = await requestCode(identity.email);
    expect(requested.status).toBe(202);
    // The console mail transport never logs the code, so overwrite its hash.
    await forceKnownCode(identity.email);

    const verified = await verify(identity.email, KNOWN_CODE);
    expect(verified.status).toBe(200);
    const { resetToken } = verified.data;
    expect(resetToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // Only a hash of the token is stored, never the token itself.
    const row = await getResetRow(identity.email);
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.tokenHash).not.toBe(resetToken);

    const confirmed = await confirm(resetToken, PWRESET_NEW_PASSWORD);
    expect(confirmed.status).toBe(204);

    await expect(login(identity.email, identity.password)).rejects.toMatchObject({
      response: { status: 401 },
    });
    const relogin = await login(identity.email, PWRESET_NEW_PASSWORD);
    expect(relogin.status).toBe(200);
    // The refresh token issued at registration died with the reset.
    await expect(
      axios.post('/api/auth/refresh', { refreshToken: data.refreshToken }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    // The reset token is single-use...
    const reusedToken = await errorResponse(confirm(resetToken, 'another-password-entirely'));
    expect(reusedToken.status).toBe(400);
    expect(reusedToken.data.message).toBe(INVALID_TOKEN);
    // ...and so is the code that produced it.
    const reusedCode = await errorResponse(verify(identity.email, KNOWN_CODE));
    expect(reusedCode.status).toBe(400);
    expect(reusedCode.data.message).toBe(INVALID_CODE);
  });

  describe('request', () => {
    // These two tests share their emails on purpose: the first request of each
    // pair is the "identical response" check, the second is the cooldown
    // check. Sharing keeps the request budget at 4 instead of 6+.
    let known: string;
    let unknown: string;

    beforeAll(async () => {
      known = (await registerPwresetUser('reset')).identity.email;
      unknown = unknownPwresetEmail();
    });

    it('answers identically for an existing and an unknown email', async () => {
      const knownRes = await requestCode(known);
      const unknownRes = await requestCode(unknown);

      expect(knownRes.status).toBe(202);
      expect(unknownRes.status).toBe(knownRes.status);
      expect(unknownRes.data).toEqual(knownRes.data);
      expect(knownRes.data).toEqual({ message: expect.any(String) });

      // The difference is only visible server-side: a row exists for the
      // account and nothing at all for the unknown email.
      expect(await getResetRow(known)).not.toBeNull();
      expect(await prisma.user.findUnique({ where: { email: unknown } })).toBeNull();
    });

    it('answers 429 to a second request within the cooldown, for known and unknown emails', async () => {
      const knownRes = await errorResponse(requestCode(known));
      const unknownRes = await errorResponse(requestCode(unknown));

      expect(knownRes.status).toBe(429);
      expect(unknownRes.status).toBe(429);
      // The 429 must not reveal whether the account exists either.
      expect(unknownRes.data).toEqual(knownRes.data);
    });
  });

  describe('verify', () => {
    it('rejects an expired code even when it is correct', async () => {
      const { identity } = await registerPwresetUser('reset');
      await forceKnownCode(identity.email);
      await expireCode(identity.email);

      const res = await errorResponse(verify(identity.email, KNOWN_CODE));
      expect(res.status).toBe(400);
      expect(res.data.message).toBe(INVALID_CODE);
    });

    // Budget note: a literal "5 sequential wrong codes, then the correct one"
    // would cost 6 verify calls; the parallel burst below proves the same
    // lockout and the race-safety together for 7. The burst is 6 wide (not 8):
    // one more than the cap is enough to detect an unenforced or non-atomic
    // limit (attempts would end at 6), and the row's `attempts` is asserted
    // directly via Prisma.
    it('locks the code after 5 attempts, however many arrive in parallel', async () => {
      const { identity } = await registerPwresetUser('reset');
      await forceKnownCode(identity.email);

      const burst = await Promise.all(
        Array.from({ length: 6 }, () => errorResponse(verify(identity.email, WRONG_CODE))),
      );
      for (const res of burst) {
        expect(res.status).toBe(400);
        expect(res.data.message).toBe(INVALID_CODE);
      }
      expect((await getResetRow(identity.email))?.attempts).toBe(5);

      // Locked: even the correct code is refused now, and the counter stays put.
      const locked = await errorResponse(verify(identity.email, KNOWN_CODE));
      expect(locked.status).toBe(400);
      expect(locked.data.message).toBe(INVALID_CODE);
      const row = await getResetRow(identity.email);
      expect(row?.attempts).toBe(5);
      expect(row?.tokenHash).toBeNull();
    });
  });

  describe('confirm', () => {
    it('rejects an unknown token and an expired token, and leaves the password alone', async () => {
      const { identity } = await registerPwresetUser('reset');
      await forceKnownCode(identity.email);
      const resetToken = await verifyForToken(identity.email);
      await expireToken(identity.email);

      const expired = await errorResponse(confirm(resetToken, PWRESET_NEW_PASSWORD));
      expect(expired.status).toBe(400);
      expect(expired.data.message).toBe(INVALID_TOKEN);

      const unknownToken = await errorResponse(
        confirm('this-token-was-never-issued-by-anyone', PWRESET_NEW_PASSWORD),
      );
      expect(unknownToken.status).toBe(400);
      expect(unknownToken.data.message).toBe(INVALID_TOKEN);

      expect((await login(identity.email, identity.password)).status).toBe(200);
    });

    it('lets exactly one of two parallel confirms through', async () => {
      const { identity } = await registerPwresetUser('reset');
      await forceKnownCode(identity.email);
      const resetToken = await verifyForToken(identity.email);

      const passwords = ['parallel-password-one-1', 'parallel-password-two-2'];
      const results = await Promise.allSettled(passwords.map((pw) => confirm(resetToken, pw)));

      const winners = results.flatMap((r, i) =>
        r.status === 'fulfilled' ? [{ status: r.value.status, password: passwords[i] }] : [],
      );
      const losers = results.flatMap((r) =>
        r.status === 'rejected' && isAxiosError(r.reason) ? [r.reason.response?.status] : [],
      );
      expect(winners).toEqual([{ status: 204, password: expect.any(String) }]);
      expect(losers).toEqual([400]);

      // Whichever confirm won, only its password works.
      const [winner] = winners;
      const loserPassword = passwords.find((p) => p !== winner.password) as string;
      expect((await login(identity.email, winner.password)).status).toBe(200);
      await expect(login(identity.email, loserPassword)).rejects.toMatchObject({
        response: { status: 401 },
      });
    });
  });

  // The one deliberately slow test in the suite: /request refuses to reissue
  // for RESEND_COOLDOWN (60s, enforced on the row's createdAt), so making a
  // second real request means really waiting it out. It is the only way to
  // exercise "a new request invalidates an unused token" end to end.
  it('invalidates an unused reset token when a new code is requested', async () => {
    const { identity } = await registerPwresetUser('reset');

    expect((await requestCode(identity.email)).status).toBe(202);
    await forceKnownCode(identity.email);
    const firstToken = await verifyForToken(identity.email);

    await new Promise((resolve) => setTimeout(resolve, 61_500));

    expect((await requestCode(identity.email)).status).toBe(202);
    const row = await getResetRow(identity.email);
    expect(row?.tokenHash).toBeNull();
    expect(row?.attempts).toBe(0);

    // The earlier, never-used token is dead...
    const stale = await errorResponse(confirm(firstToken, PWRESET_NEW_PASSWORD));
    expect(stale.status).toBe(400);
    expect(stale.data.message).toBe(INVALID_TOKEN);
    expect((await login(identity.email, identity.password)).status).toBe(200);

    // ...and the new code path works.
    await forceKnownCode(identity.email);
    const secondToken = await verifyForToken(identity.email);
    expect((await confirm(secondToken, PWRESET_NEW_PASSWORD)).status).toBe(204);
    expect((await login(identity.email, PWRESET_NEW_PASSWORD)).status).toBe(200);
  }, 90_000);
});
