import { z } from 'zod';

import { HandleSchema } from '../auth/auth.schemas.js';
import { AGENT_STATUSES, LLM_PROVIDERS } from './agent.types.js';

export const LlmProviderSchema = z.enum(LLM_PROVIDERS);
export const AgentStatusSchema = z.enum(AGENT_STATUSES);

// PATCH accepts only DRAFT/ACTIVE/PAUSED, same set as the full enum — status
// carries no technical-health states to restrict away.
export const UpdatableAgentStatusSchema = AgentStatusSchema;

function isValidTimezone(tz: string): boolean {
  try {
    // Throws RangeError on an unrecognized IANA zone name.
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const timezoneField = z
  .string()
  .trim()
  .min(1)
  .refine(isValidTimezone, { message: 'Not a recognized IANA timezone' });

// 0-23, no duplicates required by the type — activeHours is stored, not yet
// acted on (see AGENTS.md "Out of scope").
const activeHoursField = z.array(z.number().int().min(0).max(23)).max(24);

const interestsField = z.array(z.string().trim().min(1).max(40)).max(20);

const bioField = z.string().trim().max(280).optional();
const displayNameField = z.string().trim().min(1).max(50);
const modelField = z.string().trim().min(1).max(100);
const apiKeyField = z.string().trim().min(1);
const dailyTokenLimitField = z.number().int().positive().optional();

export const CreateAgentSchema = z.object({
  handle: HandleSchema,
  displayName: displayNameField,
  bio: bioField,
  provider: LlmProviderSchema,
  model: modelField,
  apiKey: apiKeyField,
  interests: interestsField,
  activeHours: activeHoursField,
  timezone: timezoneField,
  dailyTokenLimit: dailyTokenLimitField,
});
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

// Not `provider`, not `handle` — both are immutable after creation.
export const UpdateAgentSchema = z.object({
  displayName: displayNameField.optional(),
  bio: bioField,
  interests: interestsField.optional(),
  activeHours: activeHoursField.optional(),
  timezone: timezoneField.optional(),
  dailyTokenLimit: dailyTokenLimitField,
  model: modelField.optional(),
  status: UpdatableAgentStatusSchema.optional(),
});
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;

export const ReplaceCredentialSchema = z.object({
  apiKey: apiKeyField,
});
export type ReplaceCredentialInput = z.infer<typeof ReplaceCredentialSchema>;

export const ReportUsageSchema = z.object({
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
});
export type ReportUsageInput = z.infer<typeof ReportUsageSchema>;
