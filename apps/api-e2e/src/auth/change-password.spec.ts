import axios, { isAxiosError, type AxiosResponse } from 'axios';
import { prisma } from '@insula/db';

import { authHeader } from '../support/social-helpers';
import {
  cleanupPwresetUsers,
  PWRESET_NEW_PASSWORD,
  registerPwresetUser,
} from '../support/password-reset-helpers';

// POST /auth/change-password is limited to 5 calls per 15 min per user (the
// JWT `sub`), and every attempt counts, wrong-password ones included. Each test
// below therefore registers its own user; the limit test uses a dedicated user
// whose first five calls are exactly the ones that fill the window.
// The per-user counter is in-memory in the API process, which `nx e2e` boots
// fresh each run. Calls per user: happy 1, wrong 1, same 1, concurrent 2,
// limit 5 + 1 rejected, isolation 1.

jest.setTimeout(30_000);

async function errorResponse(call: Promise<AxiosResponse>): Promise<AxiosResponse> {
  try {
    await call;
  } catch (err) {
    if (isAxiosError(err) && err.response) return err.response;
    throw err;
  }
  throw new Error('expected the request to be rejected, but it succeeded');
}

const changePassword = (accessToken: string, currentPassword: string, newPassword: string) =>
  axios.post(
    '/api/auth/change-password',
    { currentPassword, newPassword },
    authHeader(accessToken),
  );
const login = (email: string, password: string) =>
  axios.post('/api/auth/login', { email, password });

describe('change password', () => {
  afterAll(async () => {
    await cleanupPwresetUsers('change');
    await prisma.$disconnect();
  });

  it('changes the password, revokes old sessions, and returns a fresh session', async () => {
    const { identity, data } = await registerPwresetUser('change');

    const res = await changePassword(data.accessToken, identity.password, PWRESET_NEW_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.data.accessToken).toEqual(expect.any(String));
    expect(res.data.refreshToken).toEqual(expect.any(String));
    expect(res.data.refreshToken).not.toBe(data.refreshToken);
    expect(res.data.user.email).toBe(identity.email);
    // A session, not a credential: nothing password-shaped comes back.
    expect(JSON.stringify(res.data)).not.toMatch(/passwordHash|newPassword|currentPassword/);

    // The refresh token just returned is live. Checked BEFORE the old one:
    // presenting a revoked token trips reuse detection, which kills every
    // session for the user, including the new one.
    const refreshed = await axios.post('/api/auth/refresh', {
      refreshToken: res.data.refreshToken,
    });
    expect(refreshed.status).toBe(200);
    // The pre-change refresh token is dead.
    await expect(
      axios.post('/api/auth/refresh', { refreshToken: data.refreshToken }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    await expect(login(identity.email, identity.password)).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect((await login(identity.email, PWRESET_NEW_PASSWORD)).status).toBe(200);
  });

  it('rejects a wrong current password with 400 (not 401) and changes nothing', async () => {
    const { identity, data } = await registerPwresetUser('change');

    // 400, not 401: the web client refreshes and retries on any 401.
    const res = await errorResponse(
      changePassword(data.accessToken, 'not-my-current-password', PWRESET_NEW_PASSWORD),
    );
    expect(res.status).toBe(400);
    expect(res.data.message).toBe('Current password is incorrect');

    expect((await login(identity.email, identity.password)).status).toBe(200);
    // Nothing was revoked either.
    expect(
      (await axios.post('/api/auth/refresh', { refreshToken: data.refreshToken })).status,
    ).toBe(200);
  });

  it('rejects a new password equal to the current one with 400', async () => {
    const { identity, data } = await registerPwresetUser('change');

    const res = await errorResponse(
      changePassword(data.accessToken, identity.password, identity.password),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a request without an access token with 401', async () => {
    const res = await errorResponse(
      axios.post('/api/auth/change-password', {
        currentPassword: 'whatever-current',
        newPassword: PWRESET_NEW_PASSWORD,
      }),
    );
    expect(res.status).toBe(401);
  });

  it('lets exactly one of two parallel changes with the same current password win', async () => {
    const { identity, data } = await registerPwresetUser('change');

    const passwords = ['parallel-change-one-1', 'parallel-change-two-2'];
    const results = await Promise.allSettled(
      passwords.map((pw) => changePassword(data.accessToken, identity.password, pw)),
    );

    const winners = results.flatMap((r, i) =>
      r.status === 'fulfilled' ? [{ status: r.value.status, password: passwords[i] }] : [],
    );
    expect(winners).toHaveLength(1);
    expect(winners[0].status).toBe(200);
    // The loser either raced the winner's commit (409, conditional update
    // matched nothing) or read the already-changed hash (400, stale current
    // password). Never a second success.
    const loserStatuses = results.flatMap((r) =>
      r.status === 'rejected' && isAxiosError(r.reason) ? [r.reason.response?.status] : [],
    );
    expect(loserStatuses).toHaveLength(1);
    expect([400, 409]).toContain(loserStatuses[0]);

    expect((await login(identity.email, winners[0].password)).status).toBe(200);
  });

  it('answers 429 to the 6th call in the window, counting wrong-password attempts', async () => {
    const { identity, data } = await registerPwresetUser('change');

    for (let i = 0; i < 5; i++) {
      const res = await errorResponse(
        changePassword(data.accessToken, 'wrong-current-password', PWRESET_NEW_PASSWORD),
      );
      expect(res.status).toBe(400);
    }

    // Even the correct current password is throttled now.
    const throttled = await errorResponse(
      changePassword(data.accessToken, identity.password, PWRESET_NEW_PASSWORD),
    );
    expect(throttled.status).toBe(429);
    expect((await login(identity.email, identity.password)).status).toBe(200);

    // The bucket is per user, not global: someone else is unaffected.
    const other = await registerPwresetUser('change');
    const ok = await changePassword(
      other.data.accessToken,
      other.identity.password,
      PWRESET_NEW_PASSWORD,
    );
    expect(ok.status).toBe(200);
  });
});
