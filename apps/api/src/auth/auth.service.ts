import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt } from 'node:crypto';

import { Prisma, type Profile, type User } from '@insula/db';
import type {
  AccessTokenPayload,
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  LoginResponse,
  LogoutInput,
  QuickRegisterInput,
  RefreshInput,
  RegisterConflictError,
  RegisterInput,
  RegisterResponse,
} from '@insula/contracts';

import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { lockUserRowShared } from './utils/lock-user-row.util.js';
import { parseTtlToMs } from './utils/parse-ttl.util.js';
import { BCRYPT_COST, DUMMY_PASSWORD_HASH } from './utils/password-hashing.js';
import { revokeAllRefreshTokens } from './utils/revoke-refresh-tokens.util.js';
import { hashToken } from './utils/token-hash.util.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(input: RegisterInput, userAgent?: string): Promise<RegisterResponse> {
    return this.createAccount(input, userAgent);
  }

  // The landing page's one-field signup: only the email is real user input.
  // Handle, display name, and password are generated server-side — the
  // handle is retried on a collision (a random suffix makes that rare, but
  // not impossible), while an email collision is a real conflict and
  // propagates immediately, same as the normal register flow.
  async registerQuick(input: QuickRegisterInput, userAgent?: string): Promise<RegisterResponse> {
    const localPart = input.email.split('@')[0] ?? '';
    const displayName = localPart || 'New user';
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.createAccount(
          {
            email: input.email,
            password: randomBytes(24).toString('base64url'),
            handle: generateHandleFromLocalPart(localPart),
            displayName,
          },
          userAgent,
        );
      } catch (err) {
        const responseBody = err instanceof ConflictException ? err.getResponse() : undefined;
        const isHandleConflict = isRegisterConflictError(responseBody) && responseBody.field === 'handle';
        if (!isHandleConflict || attempt === maxAttempts) {
          throw err;
        }
      }
    }
    // Unreachable — the loop always returns or throws — but keeps TS happy.
    throw new ConflictException('Could not generate a unique handle');
  }

  private async createAccount(input: RegisterInput, userAgent?: string): Promise<RegisterResponse> {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const avatarSeed = randomBytes(9).toString('base64url');

    let created: { user: User; profile: Profile; refreshToken: string };
    try {
      created = await this.prisma.client.$transaction(async (tx) => {
        // Profile first: a handle conflict never reaches the user insert,
        // and any thrown error rolls back the whole transaction, so an
        // email conflict never leaves an orphaned profile behind either.
        const profile = await tx.profile.create({
          data: {
            type: 'USER',
            handle: input.handle,
            displayName: input.displayName,
            avatarSeed,
          },
        });
        const user = await tx.user.create({
          data: {
            email: input.email,
            passwordHash,
            profileId: profile.id,
          },
        });
        // The session's refresh token commits atomically with the account.
        // The user row is still invisible to everyone else here, so no
        // password change can interleave with this insert.
        const refreshToken = await this.createRefreshToken(tx, user.id, userAgent);
        return { user, profile, refreshToken };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = extractUniqueConstraintFields(err.meta);
        if (target.includes('handle')) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            field: 'handle',
            message: 'Handle already in use',
          } satisfies RegisterConflictError);
        }
        if (target.includes('email')) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            field: 'email',
            message: 'Email already in use',
          } satisfies RegisterConflictError);
        }
        throw new ConflictException('Email or handle already in use');
      }
      throw err;
    }

    // Signed after commit, so no token leaves this method for a signup that
    // was rolled back.
    const accessToken = await this.signAccessToken(created.user, created.profile);
    return {
      accessToken,
      refreshToken: created.refreshToken,
      user: toAuthUser(created.user, created.profile),
    };
  }

  async login(input: LoginInput, userAgent?: string): Promise<LoginResponse> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: input.email },
      include: { profile: true },
    });

    // Always runs, against a real hash either way, so the response time
    // doesn't reveal whether the email exists.
    const passwordValid = await bcrypt.compare(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordValid) {
      // Identical for "no such email" and "wrong password" — a different
      // response for each would tell an attacker which emails are registered.
      throw new UnauthorizedException('Invalid email or password');
    }

    // bcrypt took a few hundred ms, during which a password reset or change
    // may have committed (and revoked every token). Insert the token only
    // under a row lock, and only if the hash we just verified is still the
    // committed one — otherwise it would outlive the revoke-all. See
    // lockUserRowShared for why this closes the race.
    const refreshToken = await this.prisma.client.$transaction(async (tx) => {
      const locked = await lockUserRowShared(tx, user.id);
      if (!locked || locked.passwordHash !== user.passwordHash) {
        throw new UnauthorizedException('Invalid email or password');
      }
      return this.createRefreshToken(tx, user.id, userAgent);
    });

    const accessToken = await this.signAccessToken(user, user.profile);
    return { accessToken, refreshToken, user: toAuthUser(user, user.profile) };
  }

  async refresh(input: RefreshInput): Promise<LoginResponse> {
    const tokenHash = hashToken(input.refreshToken);
    const existing = await this.prisma.client.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { profile: true } } },
    });

    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt) {
      // Reuse of an already-revoked token means two parties hold it: the
      // legitimate client and whoever stole it. Kill every session for this
      // user, not just this one token.
      await this.prisma.client.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { user } = existing;
    const refreshToken = randomBytes(32).toString('base64url');
    const newTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + parseTtlToMs(this.config.getOrThrow<string>('JWT_REFRESH_TTL')),
    );

    // Two guards, in this order:
    //  1. Lock the user row FOR SHARE, as the first statement. A password
    //     reset/change UPDATEs that row before it revokes all tokens, so it
    //     conflicts with this lock: either it committed first (and the claim
    //     below, a fresh READ COMMITTED statement, finds the old token already
    //     revoked and refuses), or it waits for this transaction and its
    //     revoke-all then sees the successor row inserted here. Without the
    //     lock the revoke-all's snapshot could predate that insert and miss it.
    //  2. Claim the old token with a conditional update (`revokedAt: null`),
    //     not a blind update of the row read above. Only the request that
    //     flips it may mint the successor, so two concurrent refreshes of the
    //     same token can't both succeed.
    await this.prisma.client.$transaction(async (tx) => {
      if (!(await lockUserRowShared(tx, user.id))) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const claimed = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt,
          userAgent: existing.userAgent,
        },
      });
    });

    const accessToken = await this.signAccessToken(user, user.profile);
    return { accessToken, refreshToken, user: toAuthUser(user, user.profile) };
  }

  async logout(input: LogoutInput): Promise<void> {
    const tokenHash = hashToken(input.refreshToken);
    await this.prisma.client.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // 0 rows matched (unknown or already-revoked token) is not an error —
    // idempotent, since revealing which tokens exist is itself a small leak.
  }

  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      // A token for a since-deleted user reads as an invalid session, not a
      // 404 — consistent with how the rest of this module treats identity.
      throw new UnauthorizedException('Invalid session');
    }
    return toAuthUser(user, user.profile);
  }

  // Authenticated password change. Identity is the JWT `sub` (resolved by the
  // guard), never anything in the body. A wrong current password is a 400, not
  // a 401: the web client treats any 401 as "access token expired" and would
  // refresh and retry, turning a typo into a pointless loop.
  //
  // Every refresh token is revoked — including the caller's own — and a fresh
  // pair is returned, so the caller keeps a session and every other device is
  // signed out. Already-issued access tokens stay valid until they expire
  // (they're stateless).
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    userAgent?: string,
  ): Promise<LoginResponse> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    // The DTO rejects this first; repeated here so the service is safe on its own.
    if (input.newPassword === input.currentPassword) {
      throw new BadRequestException('New password must differ from the current password');
    }

    // Outside the transaction: a few hundred ms of bcrypt must not hold locks.
    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_COST);

    const refreshToken = await this.prisma.client.$transaction(async (tx) => {
      // Conditional on the hash we verified against: if another request
      // changed the password since we read it, the caller's "current password"
      // is stale and nothing is written. This UPDATE must stay ahead of the
      // revoke-all: its row lock is what serialises against login/refresh
      // inserting a token (see lockUserRowShared).
      const updated = await tx.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash },
        data: { passwordHash },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Password was changed by another request; try again');
      }
      await revokeAllRefreshTokens(tx, user.id, new Date());
      return this.createRefreshToken(tx, user.id, userAgent);
    });

    // Signed after commit, so no token leaves this method for a change that
    // was rolled back.
    const accessToken = await this.signAccessToken(user, user.profile);

    // Never awaited, never throws (MailService swallows and logs failures).
    this.mail.sendPasswordChanged(user.email).catch(() => undefined);

    return { accessToken, refreshToken, user: toAuthUser(user, user.profile) };
  }

  // Persists a new refresh-token row and returns the raw token (only its hash
  // is stored). Takes the client to write through so a caller that needs the
  // row to commit atomically with other writes can pass its transaction.
  private async createRefreshToken(
    db: Prisma.TransactionClient,
    userId: string,
    userAgent?: string,
  ): Promise<string> {
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + parseTtlToMs(this.config.getOrThrow<string>('JWT_REFRESH_TTL')),
    );
    await db.refreshToken.create({
      data: { userId, tokenHash: hashToken(refreshToken), expiresAt, userAgent },
    });
    return refreshToken;
  }

  private async signAccessToken(user: User, profile: Profile): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      profileId: profile.id,
      handle: profile.handle,
      type: 'user',
    };
    // expiresIn comes from the module's default signOptions (auth.module.ts)
    // — not repeated here.
    return this.jwtService.signAsync(payload);
  }
}

const HANDLE_MAX_LENGTH = 20;
const HANDLE_SUFFIX_DIGITS = 4;

// Derives a handle from the local part of an email for the quick-signup
// flow. Always suffixed with random digits — even a clean, unclaimed local
// part shouldn't become someone's permanent handle without them choosing
// it, and the suffix is what keeps "jane" at three different domains from
// colliding with each other.
function generateHandleFromLocalPart(localPart: string): string {
  const suffix = randomInt(0, 10 ** HANDLE_SUFFIX_DIGITS).toString().padStart(HANDLE_SUFFIX_DIGITS, '0');
  const base =
    localPart
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, HANDLE_MAX_LENGTH - suffix.length - 1) || 'user';
  return `${base}_${suffix}`.slice(0, HANDLE_MAX_LENGTH);
}

function isRegisterConflictError(body: unknown): body is RegisterConflictError {
  return typeof body === 'object' && body !== null && 'field' in body;
}

// Prisma's P2002 `meta` shape differs by driver: the classic engine reports
// a flat `{ target: string[] }`, but the driver-adapter path used here
// (@prisma/adapter-pg) nests the column list under
// `driverAdapterError.cause.constraint.fields` instead. Handling both keeps
// this working regardless of which shape a given Prisma/driver version emits.
function extractUniqueConstraintFields(meta: unknown): string[] {
  if (!meta || typeof meta !== 'object') {
    return [];
  }
  const record = meta as Record<string, unknown>;

  const fields = asRecord(asRecord(asRecord(record['driverAdapterError'])?.['cause'])?.['constraint'])?.[
    'fields'
  ];
  if (Array.isArray(fields)) {
    return fields as string[];
  }

  const target = record['target'];
  return Array.isArray(target) ? (target as string[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function toAuthUser(user: User, profile: Profile): AuthUser {
  return {
    id: user.id,
    email: user.email,
    profile: {
      id: profile.id,
      handle: profile.handle,
      displayName: profile.displayName,
      avatarSeed: profile.avatarSeed,
      type: profile.type,
    },
  };
}
