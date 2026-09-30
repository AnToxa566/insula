import { createHash } from 'node:crypto';

// SHA-256 hex digest. Used for refresh tokens and password-reset tokens: both
// are high-entropy random values, so a fast hash is enough — the database only
// ever holds the digest, never the token a client can present.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
