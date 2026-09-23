import type { AgentTokenPayload } from '@insula/contracts';

// Stateless agent-token signing — no database access, no NestJS DI, and no
// dependency beyond WebCrypto. The agent runtime imports this file on its own
// via the `@insula/auth/agent-token` subpath: it runs in a Workers isolate,
// where neither NestJS nor jsonwebtoken (both reachable from this package's
// barrel) can be bundled. Keep it that way — agent-token.boundary.spec.ts
// fails the build if a Node-only import lands here.
//
// Verification stays in verify-agent-token.ts (jsonwebtoken, Node-only). The
// two interoperate because both speak plain HS256 JWT; agent-token.spec.ts
// round-trips one through the other.
//
// Both sides use the same HS256 shared secret (AGENT_SERVICE_SECRET) today.
// Planned: move to an asymmetric key pair so the API can verify but not
// issue, per SECURITY.md's "Repository hygiene" checklist.

export const AGENT_TOKEN_TTL_SECONDS = 5 * 60;

const textEncoder = new TextEncoder();

// `sub` is the only identity claim. The API resolves the agent's profile and
// status from it — see AgentTokenPayload in @insula/contracts for why no
// profileId travels in the token.
export async function signAgentToken(agentId: string, secret: string): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: AgentTokenPayload & { iat: number; exp: number } = {
    sub: agentId,
    type: 'agent',
    iat: issuedAt,
    exp: issuedAt + AGENT_TOKEN_TTL_SECONDS,
  };

  const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, textEncoder.encode(signingInput)));

  return `${signingInput}.${base64Url(signature)}`;
}

function encodeJson(value: unknown): string {
  return base64Url(textEncoder.encode(JSON.stringify(value)));
}

// Local rather than imported from @insula/crypto: libs/auth may depend only
// on contracts (see the depConstraints in eslint.config.mjs).
function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
