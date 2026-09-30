import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@insula/db';

import { registerTestUser, uniqueSuffix, type RegisterResult } from './auth-helpers';

// Shared prefix for everything these suites create — real dev/Postman data
// never uses it. Each suite adds its own sub-prefix: Jest runs the two spec
// files in parallel workers, so a suite's afterAll must delete only its own
// users or it would pull rows out from under the other suite mid-test.
export const PWRESET_EMAIL_PREFIX = 'e2e-pwreset-';

export type PwresetSuite = 'reset' | 'change' | 'race' | 'service';
const suitePrefix = (suite: PwresetSuite) => `${PWRESET_EMAIL_PREFIX}${suite}-`;

export const PWRESET_NEW_PASSWORD = 'brand-new-horse-battery-staple';

// A known-good 6-digit code for tests that need one. The API's console mail
// transport never logs the real code (by design), so a test can't read the
// emailed value — it overwrites the stored hash with this one instead.
export const KNOWN_CODE = '123456';
export const WRONG_CODE = '654321';

export async function registerPwresetUser(suite: PwresetSuite): Promise<RegisterResult> {
  return registerTestUser({ email: `${suitePrefix(suite)}${uniqueSuffix()}@example.com` });
}

// A well-formed email with no account behind it.
export function unknownPwresetEmail(): string {
  return `${suitePrefix('reset')}nobody-${uniqueSuffix()}@example.com`;
}

// Puts the user's reset row into the "code issued" state with a code the test
// knows. Upserts, so a test that isn't about /request itself doesn't have to
// spend per-IP request budget just to create the row (the request path is
// exercised on its own elsewhere). Bcrypt cost 4 keeps the helper fast; the
// server's compare works on any cost.
export async function forceKnownCode(
  email: string,
  code: string = KNOWN_CODE,
  overrides: { attempts?: number } = {},
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
  const fresh = {
    codeHash: await bcrypt.hash(code, 4),
    codeExpiresAt: new Date(Date.now() + 10 * 60_000),
    attempts: overrides.attempts ?? 0,
    tokenHash: null,
    tokenExpiresAt: null,
    usedAt: null,
  };
  await prisma.passwordReset.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...fresh },
    update: fresh,
  });
}

// Puts the user's reset row straight into the "code verified, reset token
// issued" state and returns the raw token, exactly as a successful /verify
// would leave it (only the sha256 of the token is stored). Lets a test go
// straight to /confirm without spending per-IP /verify budget.
export async function forceResetToken(email: string): Promise<string> {
  const resetToken = randomBytes(32).toString('base64url');
  await forceKnownCode(email);
  await prisma.passwordReset.updateMany({
    where: { user: { email } },
    data: {
      tokenHash: createHash('sha256').update(resetToken).digest('hex'),
      tokenExpiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  return resetToken;
}

export async function getResetRow(email: string) {
  return prisma.passwordReset.findFirst({ where: { user: { email } } });
}

export async function expireCode(email: string): Promise<void> {
  await prisma.passwordReset.updateMany({
    where: { user: { email } },
    data: { codeExpiresAt: new Date(Date.now() - 1000) },
  });
}

export async function expireToken(email: string): Promise<void> {
  await prisma.passwordReset.updateMany({
    where: { user: { email } },
    data: { tokenExpiresAt: new Date(Date.now() - 1000) },
  });
}

export async function cleanupPwresetUsers(suite: PwresetSuite): Promise<void> {
  // Deleting the Profile cascades to User, then to RefreshToken and
  // PasswordReset (deleting only the User would leave its Profile behind).
  await prisma.profile.deleteMany({ where: { user: { email: { startsWith: suitePrefix(suite) } } } });
}
