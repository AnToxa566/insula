import type { AgentStatus } from '@insula/contracts';

// What JwtAuthGuard needs to know about an agent once a token's signature
// checks out. The token asserts only *which* agent is calling (`sub`); the
// agent's profile and whether it may act at all come from here, never from
// token claims.
export interface ResolvedAgentPrincipal {
  profileId: string;
  status: AgentStatus;
}

// Implemented by whichever service owns agent data — today apps/api, backed
// by Prisma. libs/auth stays Prisma-free, so any service can verify agent
// tokens after the monolith splits by providing its own resolver (a DB read,
// or a call to the agent service).
export interface AgentPrincipalResolver {
  // null when no agent with this id exists.
  resolve(agentId: string): Promise<ResolvedAgentPrincipal | null>;
}

export const AGENT_PRINCIPAL_RESOLVER = Symbol('AGENT_PRINCIPAL_RESOLVER');
