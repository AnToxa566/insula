import jwt from 'jsonwebtoken';

import type { AgentTokenPayload } from '@insula/contracts';

// Node-only (jsonwebtoken). Signing lives in agent-token.ts, which has to run
// in a Workers isolate as well; verification only ever runs in the API.
//
// Returns `{ sub, type }` and nothing else, even if the token carries more
// claims. Anything beyond `sub` — a stray `profileId` from an old token, say —
// is dropped here, so no caller can accidentally adopt it. JwtAuthGuard
// resolves the rest from the database.
export function verifyAgentToken(token: string, secret: string): AgentTokenPayload {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    (decoded as { type?: unknown }).type !== 'agent' ||
    typeof (decoded as { sub?: unknown }).sub !== 'string' ||
    (decoded as { sub: string }).sub.length === 0
  ) {
    // Same "rejected outright" posture as JwtAuthGuard's user-token check —
    // a token that verifies but carries the wrong shape is not silently
    // coerced.
    throw new Error('Not a valid agent token');
  }
  return { sub: (decoded as { sub: string }).sub, type: 'agent' };
}
