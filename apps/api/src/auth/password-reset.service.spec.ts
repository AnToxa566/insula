import { BadRequestException, Logger } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

import type { MailService } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  CLEANUP_MIN_INTERVAL,
  CODE_TTL,
  REQUEST_ACCEPTED_MESSAGE,
  RESEND_COOLDOWN,
  STALE_RECORD_AGE,
  TOKEN_TTL,
} from './password-reset.constants.js';
import { PasswordResetService } from './password-reset.service.js';
import { DUMMY_PASSWORD_HASH } from './utils/password-hashing.js';

// Opaque stand-in for bcrypt: the "hash" never contains the plaintext, so a
// test can assert the plaintext appears nowhere it shouldn't.
jest.mock('bcrypt', () => {
  const fake = (value: string) => `hashed:${Buffer.from(value).toString('base64')}`;
  return {
    hash: jest.fn(async (value: string) => fake(value)),
    compare: jest.fn(async (value: string, hash: string) => hash === fake(value)),
  };
});

// The real module builds a PrismaClient on import; the service only needs the
// error class for its P2002 check.
jest.mock('@insula/db', () => {
  class PrismaClientKnownRequestError extends Error {
    readonly code: string;
    constructor(message: string, options: { code: string }) {
      super(message);
      this.code = options.code;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});

import { Prisma } from '@insula/db';

const NOW = new Date('2026-01-01T12:00:00.000Z');
const EMAIL = 'alice@example.com';
const USER = { id: 'user-1', email: EMAIL };
const CODE = '482913';
const CODE_HASH = `hashed:${Buffer.from(CODE).toString('base64')}`;
const NEW_PASSWORD = 'a-brand-new-password';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reset-1',
    userId: USER.id,
    codeHash: CODE_HASH,
    codeExpiresAt: new Date(NOW.getTime() + CODE_TTL),
    attempts: 0,
    tokenHash: null,
    tokenExpiresAt: null,
    usedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

function build() {
  // Calls made through the transaction client are kept apart from the plain
  // client so each test can say which one it expects.
  const tx = {
    passwordReset: { updateMany: jest.fn(), create: jest.fn() },
    user: { update: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
  };
  tx.passwordReset.updateMany.mockResolvedValue({ count: 1 });
  tx.passwordReset.create.mockResolvedValue({});
  tx.user.update.mockResolvedValue({});
  tx.refreshToken.updateMany.mockResolvedValue({ count: 2 });

  const client = {
    user: { findUnique: jest.fn() },
    passwordReset: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  client.user.findUnique.mockResolvedValue(USER);
  client.passwordReset.findUnique.mockResolvedValue(null);
  client.passwordReset.updateMany.mockResolvedValue({ count: 1 });
  client.passwordReset.deleteMany.mockResolvedValue({ count: 0 });

  const mail = {
    sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
    sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
  };

  const service = new PasswordResetService(
    { client } as unknown as PrismaService,
    mail as unknown as MailService,
  );
  return { service, tx, client, mail };
}

describe('PasswordResetService', () => {
  const spies: jest.SpyInstance[] = [];

  function spyOnLogger(): () => string {
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      spies.push(jest.spyOn(Logger.prototype, level).mockImplementation());
    }
    return () => JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    jest.clearAllMocks();
  });

  afterEach(() => {
    spies.splice(0).forEach((spy) => spy.mockRestore());
    jest.useRealTimers();
  });

  describe('request', () => {
    it('hashes a code, writes nothing and sends no mail for an unknown email, with the same body', async () => {
      const { service, client, mail } = build();
      const known = await service.request({ email: EMAIL });
      jest.clearAllMocks();

      client.user.findUnique.mockResolvedValue(null);
      const unknown = await service.request({ email: 'nobody@example.com' });

      expect(bcrypt.hash).toHaveBeenCalledTimes(1);
      expect(client.$transaction).not.toHaveBeenCalled();
      expect(mail.sendPasswordResetCode).not.toHaveBeenCalled();
      expect(unknown).toEqual({ message: REQUEST_ACCEPTED_MESSAGE });
      expect(unknown).toEqual(known);
    });

    it('stores only the hash of the code and mails the code itself', async () => {
      const { service, tx, mail } = build();

      await service.request({ email: EMAIL });

      const sentCode = mail.sendPasswordResetCode.mock.calls[0][1] as string;
      expect(mail.sendPasswordResetCode).toHaveBeenCalledWith(EMAIL, sentCode);
      expect(sentCode).toMatch(/^\d{6}$/);

      const { data, where } = tx.passwordReset.updateMany.mock.calls[0][0];
      expect(data.codeHash).toBe(`hashed:${Buffer.from(sentCode).toString('base64')}`);
      expect(data).toEqual(
        expect.objectContaining({
          attempts: 0,
          tokenHash: null,
          tokenExpiresAt: null,
          usedAt: null,
          createdAt: NOW,
          codeExpiresAt: new Date(NOW.getTime() + CODE_TTL),
        }),
      );
      // The cooldown is a condition on the row, not an in-memory check.
      expect(where).toEqual({
        userId: USER.id,
        createdAt: { lte: new Date(NOW.getTime() - RESEND_COOLDOWN) },
      });
      expect(JSON.stringify(tx.passwordReset.updateMany.mock.calls)).not.toContain(sentCode);
    });

    it('creates the row when none exists yet', async () => {
      const { service, tx, mail } = build();
      tx.passwordReset.updateMany.mockResolvedValue({ count: 0 });

      await service.request({ email: EMAIL });

      expect(tx.passwordReset.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: USER.id, attempts: 0, createdAt: NOW }),
      });
      expect(mail.sendPasswordResetCode).toHaveBeenCalledTimes(1);
    });

    it('does not await the mail', async () => {
      const { service, mail } = build();
      mail.sendPasswordResetCode.mockReturnValue(new Promise(() => undefined));

      await expect(service.request({ email: EMAIL })).resolves.toEqual({
        message: REQUEST_ACCEPTED_MESSAGE,
      });
    });

    it('does not reject when the mail promise rejects', async () => {
      const { service, mail } = build();
      mail.sendPasswordResetCode.mockRejectedValue(new Error('provider down'));

      await expect(service.request({ email: EMAIL })).resolves.toEqual({
        message: REQUEST_ACCEPTED_MESSAGE,
      });
      await flush();
    });

    it('within the cooldown writes nothing and sends no mail, but returns the same body', async () => {
      const { service, tx, mail } = build();
      const first = await service.request({ email: EMAIL });
      mail.sendPasswordResetCode.mockClear();

      // A row newer than the cooldown: the conditional update matches nothing
      // and the insert collides with the unique userId.
      tx.passwordReset.updateMany.mockResolvedValue({ count: 0 });
      tx.passwordReset.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' }),
      );
      const second = await service.request({ email: EMAIL });

      expect(second).toEqual(first);
      expect(mail.sendPasswordResetCode).not.toHaveBeenCalled();
    });

    it('propagates errors that are not a unique-constraint race', async () => {
      const { service, client } = build();
      client.$transaction.mockRejectedValue(new Error('db down'));

      await expect(service.request({ email: EMAIL })).rejects.toThrow('db down');
    });
  });

  describe('verify', () => {
    const input = { email: EMAIL, code: CODE };

    async function failureMessage(promise: Promise<unknown>): Promise<string> {
      const error = await promise.then(
        () => {
          throw new Error('expected verify to fail');
        },
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(400);
      return (error as BadRequestException).message;
    }

    it('gives every failure the same 400 message and always runs a bcrypt compare', async () => {
      const cases: Array<[string, (c: ReturnType<typeof build>) => void]> = [
        ['unknown email', (c) => c.client.user.findUnique.mockResolvedValue(null)],
        ['no record', (c) => c.client.passwordReset.findUnique.mockResolvedValue(null)],
        [
          'expired code',
          (c) =>
            c.client.passwordReset.findUnique.mockResolvedValue(
              record({ codeExpiresAt: new Date(NOW.getTime() - 1) }),
            ),
        ],
        [
          'locked',
          (c) => c.client.passwordReset.findUnique.mockResolvedValue(record({ attempts: 5 })),
        ],
        [
          'already consumed',
          (c) =>
            c.client.passwordReset.findUnique.mockResolvedValue(record({ tokenHash: 'abc' })),
        ],
        [
          'lost the attempt-slot race',
          (c) => {
            c.client.passwordReset.findUnique.mockResolvedValue(record());
            c.client.passwordReset.updateMany.mockResolvedValue({ count: 0 });
          },
        ],
        [
          'wrong code',
          (c) => {
            c.client.passwordReset.findUnique.mockResolvedValue(
              record({ codeHash: `hashed:${Buffer.from('000001').toString('base64')}` }),
            );
          },
        ],
        [
          'lost the consume race',
          (c) => {
            c.client.passwordReset.findUnique.mockResolvedValue(record());
            c.client.passwordReset.updateMany
              .mockResolvedValueOnce({ count: 1 })
              .mockResolvedValueOnce({ count: 0 });
          },
        ],
      ];

      const messages = new Set<string>();
      for (const [, arrange] of cases) {
        const ctx = build();
        arrange(ctx);
        (bcrypt.compare as jest.Mock).mockClear();
        messages.add(await failureMessage(ctx.service.verify(input)));
        expect(bcrypt.compare).toHaveBeenCalled();
      }
      expect([...messages]).toEqual(['Invalid or expired code']);
    });

    it('compares against the dummy hash when there is no usable record', async () => {
      const { service, client } = build();
      client.user.findUnique.mockResolvedValue(null);

      await failureMessage(service.verify(input));

      expect(bcrypt.compare).toHaveBeenCalledWith(expect.any(String), DUMMY_PASSWORD_HASH);
    });

    it('claims an attempt slot before comparing, guarded against overrun and replacement', async () => {
      const { service, client } = build();
      client.passwordReset.findUnique.mockResolvedValue(
        record({ codeHash: `hashed:${Buffer.from('000001').toString('base64')}` }),
      );

      await failureMessage(service.verify(input));

      expect(client.passwordReset.updateMany).toHaveBeenCalledTimes(1);
      expect(client.passwordReset.updateMany.mock.calls[0][0]).toEqual({
        where: {
          id: 'reset-1',
          codeHash: `hashed:${Buffer.from('000001').toString('base64')}`,
          tokenHash: null,
          usedAt: null,
          attempts: { lt: 5 },
          codeExpiresAt: { gt: NOW },
        },
        data: { attempts: { increment: 1 } },
      });
    });

    it('returns a 43-char base64url token and stores only its SHA-256, valid for 15 minutes', async () => {
      const { service, client } = build();
      client.passwordReset.findUnique.mockResolvedValue(record());

      const { resetToken } = await service.verify(input);

      expect(resetToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const consume = client.passwordReset.updateMany.mock.calls[1][0];
      expect(consume).toEqual({
        where: { id: 'reset-1', codeHash: CODE_HASH, tokenHash: null },
        data: {
          tokenHash: sha256(resetToken),
          tokenExpiresAt: new Date(NOW.getTime() + TOKEN_TTL),
        },
      });
      expect(JSON.stringify(client.passwordReset.updateMany.mock.calls)).not.toContain(resetToken);
    });
  });

  describe('confirm', () => {
    const input = { resetToken: 'the-reset-token', newPassword: NEW_PASSWORD };
    const live = () =>
      record({
        tokenHash: sha256(input.resetToken),
        tokenExpiresAt: new Date(NOW.getTime() + TOKEN_TTL),
        user: USER,
      });

    it.each([
      ['unknown token', null],
      [
        'expired token',
        { ...live(), tokenExpiresAt: new Date(NOW.getTime() - 1) },
      ],
      ['used token', { ...live(), usedAt: new Date(NOW.getTime() - 1000) }],
      ['code never verified', { ...live(), tokenHash: null, tokenExpiresAt: null }],
    ])('rejects a %s with 400 and does no work', async (_label, found) => {
      const { service, client, tx, mail } = build();
      client.passwordReset.findUnique.mockResolvedValue(found);

      const error = await service.confirm(input).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe('Invalid or expired reset token');
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(client.$transaction).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(mail.sendPasswordChanged).not.toHaveBeenCalled();
    });

    it('looks the token up by its hash, never the raw value', async () => {
      const { service, client } = build();
      client.passwordReset.findUnique.mockResolvedValue(live());

      await service.confirm(input);

      expect(client.passwordReset.findUnique.mock.calls[0][0].where).toEqual({
        tokenHash: sha256(input.resetToken),
      });
    });

    it('claims the token, updates the hash, revokes sessions in one transaction, then mails', async () => {
      const { service, client, tx, mail } = build();
      client.passwordReset.findUnique.mockResolvedValue(live());

      await expect(service.confirm(input)).resolves.toBeUndefined();

      expect(client.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.passwordReset.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'reset-1',
          tokenHash: sha256(input.resetToken),
          usedAt: null,
          tokenExpiresAt: { gt: NOW },
        },
        data: { usedAt: NOW },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: USER.id },
        data: { passwordHash: `hashed:${Buffer.from(NEW_PASSWORD).toString('base64')}` },
      });
      expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER.id, revokedAt: null },
        data: { revokedAt: NOW },
      });
      // The user-row UPDATE takes the row lock the login/refresh writers wait on,
      // so it must run before the revoke-all (the race fix depends on this order).
      expect(tx.user.update.mock.invocationCallOrder[0]).toBeLessThan(
        tx.refreshToken.updateMany.mock.invocationCallOrder[0],
      );
      expect(mail.sendPasswordChanged).toHaveBeenCalledWith(EMAIL);
    });

    it('hashes the new password before the transaction opens', async () => {
      const { service, client, tx } = build();
      client.passwordReset.findUnique.mockResolvedValue(live());
      const order: string[] = [];
      (bcrypt.hash as jest.Mock).mockImplementationOnce(async () => {
        order.push('hash');
        return 'h';
      });
      client.$transaction.mockImplementationOnce(async (fn) => {
        order.push('transaction');
        return fn(tx);
      });

      await service.confirm(input);

      expect(order).toEqual(['hash', 'transaction']);
    });

    it('rolls back (throws 400, no password write, no revoke, no mail) when the claim matches 0 rows', async () => {
      const { service, client, tx, mail } = build();
      client.passwordReset.findUnique.mockResolvedValue(live());
      tx.passwordReset.updateMany.mockResolvedValue({ count: 0 });

      const error = await service.confirm(input).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe('Invalid or expired reset token');
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(mail.sendPasswordChanged).not.toHaveBeenCalled();
    });

    it('does not reject when the notice mail rejects', async () => {
      const { service, client, mail } = build();
      client.passwordReset.findUnique.mockResolvedValue(live());
      mail.sendPasswordChanged.mockRejectedValue(new Error('provider down'));

      await expect(service.confirm(input)).resolves.toBeUndefined();
      await flush();
    });
  });

  describe('cleanup', () => {
    it('runs at most every 10 minutes and deletes only rows older than 24h', async () => {
      const { service, client } = build();

      await service.request({ email: EMAIL });
      await service.request({ email: EMAIL });
      await flush();
      expect(client.passwordReset.deleteMany).toHaveBeenCalledTimes(1);
      expect(client.passwordReset.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: new Date(NOW.getTime() - STALE_RECORD_AGE) } },
      });

      jest.setSystemTime(NOW.getTime() + CLEANUP_MIN_INTERVAL - 1);
      await service.request({ email: EMAIL });
      await flush();
      expect(client.passwordReset.deleteMany).toHaveBeenCalledTimes(1);

      jest.setSystemTime(NOW.getTime() + CLEANUP_MIN_INTERVAL);
      await service.request({ email: EMAIL });
      await flush();
      expect(client.passwordReset.deleteMany).toHaveBeenCalledTimes(2);
    });

    it('swallows errors and logs only a fixed message', async () => {
      const logged = spyOnLogger();
      const { service, client } = build();
      client.passwordReset.deleteMany.mockRejectedValue(new Error('boom secret-detail'));

      await expect(service.cleanupStale()).resolves.toBe(0);

      expect(logged()).toContain('PASSWORD_RESET_CLEANUP_FAILED');
      expect(logged()).not.toContain('secret-detail');
    });

    it('logs only the count', async () => {
      const logged = spyOnLogger();
      const { service, client } = build();
      client.passwordReset.deleteMany.mockResolvedValue({ count: 3 });

      await expect(service.cleanupStale()).resolves.toBe(3);

      expect(logged()).toContain('PASSWORD_RESET_CLEANUP deleted=3');
    });
  });

  describe('logging', () => {
    it('never writes a code, a reset token, or a password to the logger across the whole flow', async () => {
      const logged = spyOnLogger();
      const { service, client, mail } = build();

      await service.request({ email: EMAIL });
      const sentCode = mail.sendPasswordResetCode.mock.calls[0][1] as string;

      client.passwordReset.findUnique.mockResolvedValue(
        record({ codeHash: `hashed:${Buffer.from(sentCode).toString('base64')}` }),
      );
      const { resetToken } = await service.verify({ email: EMAIL, code: sentCode });
      await service.verify({ email: EMAIL, code: '000000' }).catch(() => undefined);

      client.passwordReset.findUnique.mockResolvedValue(
        record({
          tokenHash: sha256(resetToken),
          tokenExpiresAt: new Date(NOW.getTime() + TOKEN_TTL),
          user: USER,
        }),
      );
      await service.confirm({ resetToken, newPassword: NEW_PASSWORD });
      await service.confirm({ resetToken: 'bogus', newPassword: NEW_PASSWORD }).catch(() => undefined);
      await flush();

      const output = logged();
      expect(output).not.toContain(sentCode);
      expect(output).not.toContain(resetToken);
      expect(output).not.toContain(NEW_PASSWORD);
    });
  });
});
