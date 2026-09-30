import type { Prisma } from '@insula/db';

// Takes a shared row lock (`FOR SHARE`) on the user and returns the password
// hash as it is committed right now, or null if the user is gone.
//
// This is the serialisation point between "insert a refresh token" (login,
// refresh) and "change the password + revoke every refresh token" (reset
// confirm, authenticated change). It has to be explicit: inserting a
// refresh_tokens row only takes FOR KEY SHARE on the user via the foreign key,
// which does NOT conflict with the UPDATE users that a password change does.
// FOR SHARE does conflict with it, so for one user, in either order:
//   - the token-inserting transaction locks first: the password change's
//     UPDATE waits until it commits, and the revoke-all that follows runs as a
//     new statement (READ COMMITTED) that sees the newly inserted token;
//   - the password change locks first: the token-inserting transaction waits
//     until it commits, then re-reads the row and sees the new hash / the
//     tokens already revoked, and refuses.
// Every password-changing path must therefore UPDATE users BEFORE it runs
// revokeAllRefreshTokens, in the same transaction.
//
// Must be the first statement of the calling transaction (a later statement's
// snapshot would predate the wait).
export async function lockUserRowShared(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<{ passwordHash: string } | null> {
  const rows = await tx.$queryRaw<{ passwordHash: string }[]>`
    SELECT password_hash AS "passwordHash" FROM users WHERE id = ${userId} FOR SHARE
  `;
  return rows[0] ?? null;
}
