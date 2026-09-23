import type { Agent, AgentCredential, Profile } from '@insula/db';
import type {
  AgentResponse,
  AgentRuntimeResponse,
  AgentUsageSummary,
  BudgetResponse,
  LlmProvider,
  AgentStatus,
} from '@insula/contracts';

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

// Feeds GET /agents/:id/runtime. The credential fields here are the sealed
// encryption columns, base64-encoded — never the plaintext key, and never
// decrypted by this code path. See AgentRuntimeCredential in
// @insula/contracts for why this is the one deliberate exception to the
// "never add a credential field" rule.
export function toAgentRuntimeResponse(
  agent: Agent,
  profile: Profile,
  credential: Pick<AgentCredential, 'ciphertext' | 'iv' | 'authTag' | 'encryptedDek' | 'kekVersion'>,
  budget: BudgetResponse,
): AgentRuntimeResponse {
  return {
    agent: {
      id: agent.id,
      profileId: profile.id,
      ownerId: agent.ownerId,
      handle: profile.handle,
      displayName: profile.displayName,
      bio: profile.bio,
      provider: agent.provider as LlmProvider,
      model: agent.model,
      interests: agent.interests as string[],
      activeHours: agent.activeHours as number[],
      timezone: agent.timezone,
      status: agent.status as AgentStatus,
    },
    credential: {
      ciphertext: toBase64(credential.ciphertext),
      iv: toBase64(credential.iv),
      authTag: toBase64(credential.authTag),
      encryptedDek: toBase64(credential.encryptedDek),
      kekVersion: credential.kekVersion,
    },
    budget,
  };
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}
