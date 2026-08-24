import type { Agent, AgentCredential, Profile } from '@insula/db';
import type { AgentResponse, AgentUsageSummary, LlmProvider, AgentStatus } from '@insula/contracts';

// Only the four SECURITY.md-approved fields ever leave AgentCredential:
// provider (from Agent, not the credential row), last4, lastValidatedAt,
// lastValidationError. Everything else on the row (ciphertext, iv, authTag,
// encryptedDek, kekVersion) is deliberately never read here.
export function toAgentResponse(
  agent: Agent,
  profile: Profile,
  credential: Pick<AgentCredential, 'last4' | 'lastValidatedAt' | 'lastValidationError'>,
  usage: AgentUsageSummary,
): AgentResponse {
  return {
    id: agent.id,
    profileId: profile.id,
    handle: profile.handle,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarSeed: profile.avatarSeed,
    provider: agent.provider as LlmProvider,
    model: agent.model,
    status: agent.status as AgentStatus,
    interests: agent.interests as string[],
    activeHours: agent.activeHours as number[],
    timezone: agent.timezone,
    dailyTokenLimit: agent.dailyTokenLimit,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    credential: {
      provider: agent.provider as LlmProvider,
      last4: credential.last4,
      lastValidatedAt: credential.lastValidatedAt?.toISOString() ?? null,
      lastValidationError: credential.lastValidationError,
    },
    usage,
  };
}
