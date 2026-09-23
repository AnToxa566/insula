import axios from 'axios';

import { signAgentToken } from '@insula/auth';
import { prisma } from '@insula/db';

import { uniqueSuffix } from './auth-helpers';
import { authHeader } from './social-helpers';

// Matches apps/api/src/agent/validation/provider-validation-stub.util.ts —
// these tests exercise the full create-agent flow over real HTTP against a
// separately-spawned server process, so a Nest DI override can't reach it.
// This reserved prefix is how the server is told to skip the real provider
// call without a Nest TestingModule.
export const STUB_VALID_KEY = 'insula-e2e-stub-valid-key';
export const STUB_INVALID_KEY = 'insula-e2e-stub-invalid';

export function createAgentBody(overrides: Record<string, unknown> = {}) {
  return {
    handle: `agt${uniqueSuffix()}`,
    displayName: 'E2E Agent',
    provider: 'ANTHROPIC',
    model: 'claude-sonnet-5',
    apiKey: STUB_VALID_KEY,
    interests: ['tech', 'news'],
    activeHours: [9, 10, 11],
    timezone: 'UTC',
    ...overrides,
  };
}

// Mints an agent service token the same way agent-runtime does
// (libs/auth#signAgentToken, no DB access) — signed with the same
// AGENT_SERVICE_SECRET the live server reads from the same .env, so the
// server's JwtAuthGuard verifies it exactly as it would a real one. The
// token carries only the agent id; the server resolves the profile.
export async function agentAuthHeader(agentId: string) {
  const secret = process.env['AGENT_SERVICE_SECRET'];
  if (!secret) {
    throw new Error('AGENT_SERVICE_SECRET is not set in the test process env');
  }
  const token = await signAgentToken(agentId, secret);
  return { headers: { Authorization: `Bearer ${token}` } };
}

// New agents are created DRAFT, and JwtAuthGuard answers 403 to any agent
// token whose agent isn't ACTIVE — so a spec that acts *as* an agent has to
// activate it first, through the same owner PATCH a real user would use.
export async function setAgentStatus(
  agentId: string,
  ownerAccessToken: string,
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED',
): Promise<void> {
  await axios.patch(`/api/agents/${agentId}`, { status }, authHeader(ownerAccessToken));
}

// Deleting the User directly (the established afterAll pattern in the other
// social spec files) only cascades User -> nothing; it does not reach an
// owned agent's Profile, because the cascade runs Profile -> Agent, not the
// reverse (see agents.service.ts#remove). Left alone, that would strand an
// AgentCredential row per test run — exactly what this project's threat
// model treats most seriously. Deleting those profiles first cascades away
// the Agent, AgentCredential, and TokenUsage rows too.
export async function cleanupAgentTestData(client: typeof prisma, emailPrefix: string): Promise<void> {
  const owners = await client.user.findMany({
    where: { email: { startsWith: emailPrefix } },
    select: { id: true },
  });
  const ownerIds = owners.map((o) => o.id);
  if (ownerIds.length) {
    await client.profile.deleteMany({ where: { agent: { ownerId: { in: ownerIds } } } });
  }
  await client.user.deleteMany({ where: { email: { startsWith: emailPrefix } } });
}
