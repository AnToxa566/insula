import axios from 'axios';
import { prisma } from '@insula/db';

import { E2E_EMAIL_PREFIX, registerTestUser, uniqueTestIdentity } from '../support/auth-helpers';

describe('auth', () => {
  afterAll(async () => {
    // Cascades clean up Profile and RefreshToken rows for these users. Only
    // rows created by this suite are touched — real dev/Postman data is
    // untouched since it never uses the e2e-auth- email prefix.
    await prisma.user.deleteMany({ where: { email: { startsWith: E2E_EMAIL_PREFIX } } });
    await prisma.$disconnect();
  });

  it('registers, logs in, and fetches /me with the returned access token', async () => {
    const { identity, data } = await registerTestUser();
    expect(data.user.email).toBe(identity.email);
    expect(data.accessToken).toEqual(expect.any(String));
    expect(data.refreshToken).toEqual(expect.any(String));

    const loginRes = await axios.post('/api/auth/login', {
      email: identity.email,
      password: identity.password,
    });
    expect(loginRes.status).toBe(200);

    const meRes = await axios.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${loginRes.data.accessToken}` },
    });
    expect(meRes.status).toBe(200);
    expect(meRes.data.email).toBe(identity.email);
    expect(meRes.data.profile.handle).toBe(identity.handle);
  });

  it('rejects a duplicate email with 409 naming the email', async () => {
    const { identity } = await registerTestUser();

    await expect(
      axios.post('/api/auth/register', {
        ...identity,
        handle: uniqueTestIdentity().handle,
      }),
    ).rejects.toMatchObject({
      response: { status: 409, data: { message: expect.stringMatching(/email/i) } },
    });
  });

  it('rejects a duplicate handle with 409 naming the handle', async () => {
    const { identity } = await registerTestUser();

    await expect(
      axios.post('/api/auth/register', {
        ...identity,
        email: uniqueTestIdentity().email,
      }),
    ).rejects.toMatchObject({
      response: { status: 409, data: { message: expect.stringMatching(/handle/i) } },
    });
  });

  it('rejects a reserved handle with 400', async () => {
    const identity = uniqueTestIdentity();

    await expect(
      axios.post('/api/auth/register', { ...identity, handle: 'admin' }),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('rejects login with an unregistered email with 401', async () => {
    const identity = uniqueTestIdentity();

    await expect(
      axios.post('/api/auth/login', { email: identity.email, password: identity.password }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('rejects login with the wrong password with 401', async () => {
    const { identity } = await registerTestUser();

    await expect(
      axios.post('/api/auth/login', { email: identity.email, password: 'not-the-password' }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('rejects /me without an access token with 401', async () => {
    await expect(axios.get('/api/auth/me')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('rotates the refresh token on /refresh and invalidates the old one', async () => {
    const { data } = await registerTestUser();

    // Wait some time to ensure that expireAt will
    // be different so access token will be different
    await new Promise((r) => setTimeout(r, 2000));

    const rotated = await axios.post('/api/auth/refresh', { refreshToken: data.refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.data.refreshToken).not.toBe(data.refreshToken);
    expect(rotated.data.accessToken).not.toBe(data.accessToken);

    await expect(
      axios.post('/api/auth/refresh', { refreshToken: data.refreshToken }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('kills every session when a revoked refresh token is reused', async () => {
    const { data } = await registerTestUser();
    const originalRefreshToken = data.refreshToken;

    const rotated = await axios.post('/api/auth/refresh', {
      refreshToken: originalRefreshToken,
    });
    const rotatedRefreshToken = rotated.data.refreshToken;

    // Reusing the now-revoked original token...
    await expect(
      axios.post('/api/auth/refresh', { refreshToken: originalRefreshToken }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    // ...must also kill the still-live rotated token — proving mass
    // revocation happened, not just that the reused token itself failed.
    await expect(
      axios.post('/api/auth/refresh', { refreshToken: rotatedRefreshToken }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  // Regression check for the register-persists-its-refresh-token decision:
  // if register ever stopped calling issueTokenPair, this would 401 instead.
  it('persists the refresh token issued at registration', async () => {
    const { data } = await registerTestUser();

    const refreshRes = await axios.post('/api/auth/refresh', {
      refreshToken: data.refreshToken,
    });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.data.accessToken).toEqual(expect.any(String));
    expect(refreshRes.data.refreshToken).not.toBe(data.refreshToken);
  });
});
