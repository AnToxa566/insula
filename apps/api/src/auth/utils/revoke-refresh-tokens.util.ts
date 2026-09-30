import type { Prisma } from '@insula/db';

// Revokes every live refresh token for a user. Takes the caller's transaction
// client so the revoke commits (or rolls back) together with the password
// change that motivated it. Access tokens are stateless and stay valid until
// they expire; only refresh is cut off.
export function revokeAllRefreshTokens(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<Prisma.BatchPayload> {
  return tx.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
}
