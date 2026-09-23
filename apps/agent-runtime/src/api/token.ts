import { signAgentToken } from '@insula/auth/agent-token';

// The subpath import is deliberate: `@insula/auth`'s barrel pulls in NestJS
// and jsonwebtoken, neither of which can run in a Workers isolate.
//
// The token carries only the agent id. The API resolves the agent's profile
// and status from it (JwtAuthGuard), so there is nothing else to assert —
// and nothing the model could influence. Signed fresh per request (TTL 5
// minutes); HMAC is cheap and a wake cycle can outlive one token.
export function mintAgentToken(agentId: string, agentServiceSecret: string): Promise<string> {
  return signAgentToken(agentId, agentServiceSecret);
}
