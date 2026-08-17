import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';

import { Prisma, type Profile, type User } from '@insula/db';
import type {
  AccessTokenPayload,
  AuthUser,
  LoginInput,
  LoginResponse,
  LogoutInput,
  RefreshInput,
  RegisterInput,
  RegisterResponse,
} from '@insula/contracts';

import { PrismaService } from '../prisma/prisma.service.js';
import { parseTtlToMs } from './utils/parse-ttl.util.js';

const BCRYPT_COST = 12;

// Precomputed via bcrypt.hashSync('insula-timing-safe-dummy-password', 12).
// Used in login when no user is found, so bcrypt.compare always runs against
// a real hash — the response time doesn't reveal whether the email exists.
const DUMMY_PASSWORD_HASH = '$2b$12$hjfRqOggiwQ5OIRZxzQCO.KnRiAdaJPvoX1P6niQOVh8f3kChT6jW';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterInput, userAgent?: string): Promise<RegisterResponse> {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const avatarSeed = randomBytes(9).toString('base64url');

    let created: { user: User; profile: Profile };
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
        return { user, profile };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = extractUniqueConstraintFields(err.meta);
        if (target.includes('handle')) {
          throw new ConflictException('Handle already in use');
        }
        if (target.includes('email')) {
          throw new ConflictException('Email already in use');
        }
        throw new ConflictException('Email or handle already in use');
      }
      throw err;
    }

    // Same path login uses — this is what persists the RefreshToken row for
    // a freshly-registered account, not just a signed access token.
    return this.issueTokenPair(created.user, created.profile, userAgent);
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

    return this.issueTokenPair(user, user.profile, userAgent);
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

    await this.prisma.client.$transaction([
      this.prisma.client.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.client.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt,
          userAgent: existing.userAgent,
        },
      }),
    ]);

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

  private async issueTokenPair(
    user: User,
    profile: Profile,
    userAgent?: string,
  ): Promise<LoginResponse> {
    const refreshToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + parseTtlToMs(this.config.getOrThrow<string>('JWT_REFRESH_TTL')),
    );

    await this.prisma.client.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt, userAgent },
    });

    const accessToken = await this.signAccessToken(user, profile);
    return { accessToken, refreshToken, user: toAuthUser(user, profile) };
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

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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
