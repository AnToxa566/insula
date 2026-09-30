import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

// Opaque stand-in for bcrypt: the "hash" never contains the plaintext.
jest.mock('bcrypt', () => {
  const fake = (value: string) => `hashed:${Buffer.from(value).toString('base64')}`;
  return {
    hash: jest.fn(async (value: string) => fake(value)),
    compare: jest.fn(async (value: string, hash: string) => hash === fake(value)),
  };
});

// The real module builds a PrismaClient on import; changePassword never
// touches the Prisma namespace, so an empty stand-in is enough.
jest.mock('@insula/db', () => ({ Prisma: {} }));

const OLD_PASSWORD = 'the-old-password';
const NEW_PASSWORD = 'the-new-password';
const fake = (value: string) => `hashed:${Buffer.from(value).toString('base64')}`;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const PROFILE = {
  id: 'profile-1',
  handle: 'alice',
  displayName: 'Alice',
  avatarSeed: 'seed',
  type: 'USER' as const,
};
const USER = {
  id: 'user-1',
  email: 'alice@example.com',
  passwordHash: fake(OLD_PASSWORD),
  profileId: PROFILE.id,
  profile: PROFILE,
};

function build() {
  const tx = {
    // The FOR SHARE user-row lock (lockUserRowShared) returns the committed hash.
    $queryRaw: jest.fn().mockResolvedValue([{ passwordHash: USER.passwordHash }]),
    user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    refreshToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const client = {
    user: { findUnique: jest.fn().mockResolvedValue(USER) },
    refreshToken: { findUnique: jest.fn() },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-access-token') };
  const config = { getOrThrow: jest.fn().mockReturnValue('7d') };
  const mail = { sendPasswordChanged: jest.fn().mockResolvedValue(undefined) };

  const service = new AuthService(
    { client } as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
    mail as unknown as MailService,
  );
  return { service, client, tx, jwt, mail };
}

describe('AuthService.changePassword', () => {
  const input = { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD };

  beforeEach(() => jest.clearAllMocks());

  it('rejects a wrong current password with 400 and writes nothing', async () => {
    const { service, client, tx, mail } = build();

    const error = await service
      .changePassword(USER.id, { ...input, currentPassword: 'not-it' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getStatus()).toBe(400);
    expect((error as BadRequestException).message).toBe('Current password is incorrect');
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(mail.sendPasswordChanged).not.toHaveBeenCalled();
  });

  it('rejects a new password equal to the current one with 400', async () => {
    const { service, client, tx } = build();

    const error = await service
      .changePassword(USER.id, { currentPassword: OLD_PASSWORD, newPassword: OLD_PASSWORD })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(
      'New password must differ from the current password',
    );
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(client.$transaction).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an unknown subject with 401', async () => {
    const { service, client } = build();
    client.user.findUnique.mockResolvedValue(null);

    await expect(service.changePassword('ghost', input)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it('updates the hash, revokes all tokens and stores a new one in a single transaction', async () => {
    const { service, client, tx, jwt, mail } = build();

    const result = await service.changePassword(USER.id, input, 'jest-agent');

    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: USER.id, passwordHash: USER.passwordHash },
      data: { passwordHash: fake(NEW_PASSWORD) },
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: USER.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });

    // The new token row is written through the same transaction client, after
    // the revoke (so revoke-all can't catch it), and stores only the hash.
    const created = tx.refreshToken.create.mock.calls[0][0].data;
    // The user-row UPDATE takes the row lock the login/refresh writers wait on,
    // so it must run before the revoke-all (the race fix depends on this order).
    expect(tx.user.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.refreshToken.updateMany.mock.invocationCallOrder[0],
    );
    expect(tx.refreshToken.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.refreshToken.create.mock.invocationCallOrder[0],
    );
    expect(created).toEqual({
      userId: USER.id,
      tokenHash: sha256(result.refreshToken),
      expiresAt: expect.any(Date),
      userAgent: 'jest-agent',
    });
    expect(JSON.stringify(tx.refreshToken.create.mock.calls)).not.toContain(result.refreshToken);

    expect(result).toEqual({
      accessToken: 'signed-access-token',
      refreshToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      user: { id: USER.id, email: USER.email, profile: PROFILE },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: USER.id,
      profileId: PROFILE.id,
      handle: PROFILE.handle,
      type: 'user',
    });
    expect(mail.sendPasswordChanged).toHaveBeenCalledWith(USER.email);
  });

  it('hashes the new password before the transaction opens', async () => {
    const { service, client, tx } = build();
    const order: string[] = [];
    (bcrypt.hash as jest.Mock).mockImplementationOnce(async () => {
      order.push('hash');
      return 'h';
    });
    client.$transaction.mockImplementationOnce(async (fn) => {
      order.push('transaction');
      return fn(tx);
    });

    await service.changePassword(USER.id, input);

    expect(order).toEqual(['hash', 'transaction']);
  });

  it('answers 409 and rolls back when the conditional update matches 0 rows', async () => {
    const { service, tx, jwt, mail } = build();
    tx.user.updateMany.mockResolvedValue({ count: 0 });

    const error = await service.changePassword(USER.id, input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getStatus()).toBe(409);
    // Thrown before anything else in the transaction ran, so the real client
    // rolls back; and nothing was handed to the caller.
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(mail.sendPasswordChanged).not.toHaveBeenCalled();
  });

  it('does not wait for, or fail on, the notice mail', async () => {
    const { service, mail } = build();
    mail.sendPasswordChanged.mockReturnValue(new Promise(() => undefined));
    await expect(service.changePassword(USER.id, input)).resolves.toBeDefined();

    mail.sendPasswordChanged.mockRejectedValue(new Error('provider down'));
    await expect(service.changePassword(USER.id, input)).resolves.toBeDefined();
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
});

// The user-row lock's SQL, as recorded by the tagged-template mock.
function lockedSql(call: unknown[]): string {
  return (call[0] as string[]).join('?').replace(/\s+/g, ' ').trim();
}

describe('AuthService.refresh', () => {
  const STORED = {
    id: 'rt-1',
    userId: USER.id,
    tokenHash: sha256('old-refresh-token'),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    userAgent: 'jest-agent',
    user: USER,
  };

  beforeEach(() => jest.clearAllMocks());

  it('locks the user row FOR SHARE as the first statement, before claiming the old token', async () => {
    const { service, client, tx } = build();
    client.refreshToken.findUnique.mockResolvedValue(STORED);
    tx.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.refresh({ refreshToken: 'old-refresh-token' });

    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(lockedSql(tx.$queryRaw.mock.calls[0])).toContain('FROM users WHERE id = ? FOR SHARE');
    expect(tx.$queryRaw.mock.calls[0][1]).toBe(USER.id);

    const lock = tx.$queryRaw.mock.invocationCallOrder[0];
    const claim = tx.refreshToken.updateMany.mock.invocationCallOrder[0];
    const insert = tx.refreshToken.create.mock.invocationCallOrder[0];
    expect(lock).toBeLessThan(claim);
    expect(claim).toBeLessThan(insert);
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: STORED.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.refreshToken.create.mock.calls[0][0].data.tokenHash).toBe(sha256(result.refreshToken));
  });

  it('answers 401 and inserts nothing when the claim finds the token already revoked', async () => {
    const { service, client, tx, jwt } = build();
    client.refreshToken.findUnique.mockResolvedValue(STORED);
    // What a refresh sees once a concurrent reset committed its revoke-all
    // while this transaction waited on the user-row lock.
    tx.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.refresh({ refreshToken: 'old-refresh-token' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('answers 401 and writes nothing when the user row is gone', async () => {
    const { service, client, tx } = build();
    client.refreshToken.findUnique.mockResolvedValue(STORED);
    tx.$queryRaw.mockResolvedValue([]);

    await expect(service.refresh({ refreshToken: 'old-refresh-token' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  const input = { email: USER.email, password: OLD_PASSWORD };

  beforeEach(() => jest.clearAllMocks());

  it('inserts the refresh token under the FOR SHARE user-row lock, after re-verifying the hash', async () => {
    const { service, tx, jwt } = build();

    const result = await service.login(input, 'jest-agent');

    expect(lockedSql(tx.$queryRaw.mock.calls[0])).toContain('FROM users WHERE id = ? FOR SHARE');
    expect(tx.$queryRaw.mock.calls[0][1]).toBe(USER.id);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.refreshToken.create.mock.invocationCallOrder[0],
    );
    expect(tx.refreshToken.create.mock.calls[0][0].data).toEqual({
      userId: USER.id,
      tokenHash: sha256(result.refreshToken),
      expiresAt: expect.any(Date),
      userAgent: 'jest-agent',
    });
    // Signed after the transaction committed.
    expect(jwt.signAsync).toHaveBeenCalledTimes(1);
  });

  it('answers the generic 401 and inserts nothing when the password hash changed after the compare', async () => {
    const { service, tx, jwt } = build();
    // A reset/change committed while bcrypt.compare was running.
    tx.$queryRaw.mockResolvedValue([{ passwordHash: fake(NEW_PASSWORD) }]);

    const error = await service.login(input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getStatus()).toBe(401);
    expect((error as UnauthorizedException).message).toBe('Invalid email or password');
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('answers the generic 401 when the user row vanished after the compare', async () => {
    const { service, tx } = build();
    tx.$queryRaw.mockResolvedValue([]);

    await expect(service.login(input)).rejects.toThrow('Invalid email or password');
    expect(tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('opens no transaction for a wrong password', async () => {
    const { service, client } = build();

    await expect(service.login({ ...input, password: 'nope' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});
