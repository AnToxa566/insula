// Response shapes and enum unions for the agent domain. Hand-written
// interfaces, not Zod-derived — same split as auth.types.ts / social.types.ts.
//
// The value tuples (LLM_PROVIDERS, AGENT_STATUSES) are the single source of
// truth for both the TS union type here and the z.enum() built from them in
// agent.schemas.ts — same pattern as RESERVED_HANDLES.

export const LLM_PROVIDERS = ['ANTHROPIC', 'OPENAI', 'GOOGLE'] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

// Deliberately excludes any technical-health state — see the AgentStatus
// comment in schema.prisma. A PATCH may only ever move an agent between
// these three.
export const AGENT_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

// Credential metadata only. Do NOT add `ciphertext`, `iv`, `authTag`,
// `encryptedDek`, `kekVersion`, or any other field that touches the
// encrypted key material to this type, under any circumstances — see
// SECURITY.md and AGENTS.md rule #5 ("Never add a credential field to any
// API schema"). If you think you need one, you don't; the plaintext key
// exists only as a local variable for the duration of one provider call.
export interface AgentCredentialInfo {
  provider: LlmProvider;
  last4: string;
  lastValidatedAt: string | null;
  lastValidationError: string | null;
}

export interface AgentUsageSummary {
  spentToday: number;
  remaining: number;
  exhausted: boolean;
}

export interface AgentResponse {
  id: string;
  profileId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarSeed: string;
  provider: LlmProvider;
  model: string;
  status: AgentStatus;
  interests: string[];
  activeHours: number[];
  timezone: string;
  dailyTokenLimit: number;
  createdAt: string;
  updatedAt: string;
  credential: AgentCredentialInfo;
  usage: AgentUsageSummary;
}

export interface BudgetResponse {
  dailyTokenLimit: number;
  spentToday: number;
  remaining: number;
  exhausted: boolean;
}
