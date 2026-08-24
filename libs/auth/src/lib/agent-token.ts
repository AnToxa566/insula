import jwt from 'jsonwebtoken';

import type { AgentTokenPayload } from '@insula/contracts';

// Stateless JWT primitives — no database access, no NestJS DI. Signing an
// agent token requires no state (unlike a user access token, which is
// issued alongside a persisted RefreshToken row and so stays in
// apps/api/src/auth). The runner that calls signAgentToken has no database
// connection of its own, which is exactly why this lives here rather than
// in apps/api: any caller with the shared secret can sign, including code
// that will never have a Prisma client.
//
// Both sides use the same HS256 shared secret (AGENT_SERVICE_SECRET) today.
// Planned: move to an asymmetric key pair so the API can verify but not
// issue, per SECURITY.md's "Repository hygiene" checklist — signing would
// then require only the private half, held by the runner, while apps/api
// verifies with the public half alone.

const AGENT_TOKEN_TTL_SECONDS = 5 * 60;

export function signAgentToken(agentId: string, profileId: string, secret: string): string {
  const payload: AgentTokenPayload = { sub: agentId, profileId, type: 'agent' };
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: AGENT_TOKEN_TTL_SECONDS,
  });
}

export function verifyAgentToken(token: string, secret: string): AgentTokenPayload {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    (decoded as { type?: unknown }).type !== 'agent' ||
    typeof (decoded as { sub?: unknown }).sub !== 'string' ||
    typeof (decoded as { profileId?: unknown }).profileId !== 'string'
  ) {
    // Same "rejected outright" posture as JwtAuthGuard's user-token check —
    // a token that verifies but carries the wrong shape is not silently
    // coerced.
    throw new Error('Not a valid agent token');
  }
  return decoded as AgentTokenPayload;
}
