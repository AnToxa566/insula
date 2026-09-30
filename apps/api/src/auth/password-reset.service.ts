import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'node:crypto';

import { Prisma } from '@insula/db';
import type {
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  PasswordResetRequestResponse,
  PasswordResetVerifyInput,
  PasswordResetVerifyResponse,
} from '@insula/contracts';

import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CLEANUP_MIN_INTERVAL,
  CODE_TTL,
  MAX_CODE_ATTEMPTS,
  REQUEST_ACCEPTED_MESSAGE,
  RESEND_COOLDOWN,
  STALE_RECORD_AGE,
  TOKEN_TTL,
} from './password-reset.constants.js';
import { BCRYPT_COST, DUMMY_PASSWORD_HASH } from './utils/password-hashing.js';
import { revokeAllRefreshTokens } from './utils/revoke-refresh-tokens.util.js';
import { hashToken } from './utils/token-hash.util.js';

// One message for every verify failure (unknown email, no record, expired,
// locked, wrong code, lost a race) — distinguishing them would tell an
// attacker which emails have a pending reset and how many guesses remain.
const INVALID_CODE_MESSAGE = 'Invalid or expired code';
const INVALID_TOKEN_MESSAGE = 'Invalid or expired reset token';

// State is derived from the columns of the single per-user row:
//   code active = tokenHash null, usedAt null, attempts < MAX, code unexpired
//   consumed    = tokenHash set (a reset token was issued)
//   locked      = attempts >= MAX
//   token used  = usedAt set
interface ResetRecord {
  tokenHash: string | null;
  usedAt: Date | null;
  attempts: number;
  codeExpiresAt: Date;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private lastCleanupAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // The response is identical for every outcome: known email, unknown email,
  // and "a code was already sent a moment ago".
  async request(input: PasswordResetRequestInput): Promise<PasswordResetRequestResponse> {
    // Both always run, so the work done (and the time taken) doesn't depend on
    // whether the email exists.
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_COST);

    const user = await this.prisma.client.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true },
    });

    if (user && (await this.storeCode(user.id, codeHash))) {
      // Not awaited: MailService never rejects, and waiting on the provider
      // would make known emails measurably slower than unknown ones.
      fireAndForget(this.mail.sendPasswordResetCode(user.email, code));
    }

    this.maybeCleanup();
    return { message: REQUEST_ACCEPTED_MESSAGE };
  }

  async verify(input: PasswordResetVerifyInput): Promise<PasswordResetVerifyResponse> {
    const now = new Date();
    const user = await this.prisma.client.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    const record = user
      ? await this.prisma.client.passwordReset.findUnique({ where: { userId: user.id } })
      : null;

    if (!record || !isCodeActive(record, now)) {
      throw await rejectCode();
    }

    // Claim an attempt slot BEFORE comparing. Parallel guesses each try to
    // increment under `attempts < MAX`, so at most MAX of them ever get to
    // compare — a burst can't exceed the cap. The guard on codeHash means a
    // code replaced by a newer /request is not claimable either.
    const claimed = await this.prisma.client.passwordReset.updateMany({
      where: {
        id: record.id,
        codeHash: record.codeHash,
        tokenHash: null,
        usedAt: null,
        attempts: { lt: MAX_CODE_ATTEMPTS },
        codeExpiresAt: { gt: now },
      },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      throw await rejectCode();
    }

    // A wrong code is just a 400: the attempt is already counted.
    if (!(await bcrypt.compare(input.code, record.codeHash))) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }

    const resetToken = randomBytes(32).toString('base64url');
    // Consuming is conditional on the code still being the unconsumed one, so
    // two parallel correct guesses yield one token, not two.
    const consumed = await this.prisma.client.passwordReset.updateMany({
      where: { id: record.id, codeHash: record.codeHash, tokenHash: null },
      data: {
        tokenHash: hashToken(resetToken),
        tokenExpiresAt: new Date(now.getTime() + TOKEN_TTL),
      },
    });
    if (consumed.count !== 1) {
      throw new BadRequestException(INVALID_CODE_MESSAGE);
    }

    return { resetToken };
  }

  async confirm(input: PasswordResetConfirmInput): Promise<void> {
    const tokenHash = hashToken(input.resetToken);
    const record = await this.prisma.client.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    });

    const now = new Date();
    if (!record || record.usedAt || !record.tokenExpiresAt || record.tokenExpiresAt <= now) {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE);
    }

    // Outside the transaction: bcrypt at cost 12 takes a few hundred ms, and
    // holding row locks that long would stall concurrent requests.
    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_COST);

    await this.prisma.client.$transaction(async (tx) => {
      const txNow = new Date();
      // The single-use guard. Two parallel confirms both passed the read
      // above; only one flips `usedAt`, the other sees count 0, throws, and
      // its whole transaction is rolled back.
      const claimed = await tx.passwordReset.updateMany({
        where: { id: record.id, tokenHash, usedAt: null, tokenExpiresAt: { gt: txNow } },
        data: { usedAt: txNow },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException(INVALID_TOKEN_MESSAGE);
      }
      // This UPDATE must stay ahead of the revoke-all: its row lock is what
      // serialises against login/refresh inserting a token (see
      // lockUserRowShared), so the revoke below can't miss one.
      await tx.user.update({ where: { id: record.user.id }, data: { passwordHash } });
      await revokeAllRefreshTokens(tx, record.user.id, txNow);
    });

    // After commit, never awaited.
    fireAndForget(this.mail.sendPasswordChanged(record.user.email));
  }

  // Public so a future scheduler can call it; today it only runs from
  // maybeCleanup(). Never throws and logs only the count.
  async cleanupStale(): Promise<number> {
    try {
      const { count } = await this.prisma.client.passwordReset.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - STALE_RECORD_AGE) } },
      });
      if (count > 0) {
        this.logger.log(`PASSWORD_RESET_CLEANUP deleted=${count}`);
      }
      return count;
    } catch {
      this.logger.warn('PASSWORD_RESET_CLEANUP_FAILED');
      return 0;
    }
  }

  // Cleanup rides on /request rather than a cron: at most once per
  // CLEANUP_MIN_INTERVAL per instance, fire and forget.
  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanupAt < CLEANUP_MIN_INTERVAL) return;
    this.lastCleanupAt = now;
    void this.cleanupStale();
  }

  // Writes the new code only if at least RESEND_COOLDOWN has passed since the
  // previous one. Returns whether THIS call wrote the row (and so should send
  // the mail). The unique userId makes this safe under concurrency: a second
  // in-flight request either sees the fresh createdAt (update matches 0 rows)
  // and then collides on the insert, or loses the insert race — both surface
  // as P2002 and end silently.
  private async storeCode(userId: string, codeHash: string): Promise<boolean> {
    const now = new Date();
    const fresh = {
      codeHash,
      codeExpiresAt: new Date(now.getTime() + CODE_TTL),
      attempts: 0,
      tokenHash: null,
      tokenExpiresAt: null,
      usedAt: null,
      createdAt: now,
    };

    try {
      await this.prisma.client.$transaction(async (tx) => {
        const updated = await tx.passwordReset.updateMany({
          where: { userId, createdAt: { lte: new Date(now.getTime() - RESEND_COOLDOWN) } },
          data: fresh,
        });
        if (updated.count === 0) {
          await tx.passwordReset.create({ data: { userId, ...fresh } });
        }
      });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return false;
      }
      throw err;
    }
  }
}

function isCodeActive(record: ResetRecord, now: Date): boolean {
  return (
    record.tokenHash === null &&
    record.usedAt === null &&
    record.attempts < MAX_CODE_ATTEMPTS &&
    record.codeExpiresAt > now
  );
}

// Runs a bcrypt compare against a real hash so a rejected request costs the
// same as a real guess, then hands back the one shared error to throw.
async function rejectCode(): Promise<BadRequestException> {
  await bcrypt.compare('000000', DUMMY_PASSWORD_HASH);
  return new BadRequestException(INVALID_CODE_MESSAGE);
}

// MailService never rejects (and logs its own failures), so this is belt and
// braces: a rejection nobody awaits would otherwise crash the process.
function fireAndForget(promise: Promise<void>): void {
  promise.catch(() => undefined);
}

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}
