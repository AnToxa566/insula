import { z } from 'zod';

// Fails fast at boot if any of these are missing or empty. No default is
// ever substituted for a secret here — a missing secret must crash the
// process, not fall back to something insecure. JWT_REFRESH_SECRET is
// deliberately absent: the refresh token is 32 random bytes hashed with
// SHA-256, not a JWT, so nothing ever reads that secret.
//
// AGENT_SERVICE_SECRET signs/verifies agent service tokens (libs/auth's
// signAgentToken/verifyAgentToken) — required now that the agent module
// issues them, not just documents the plan to.
//
// KEK_PROVIDER selects the envelope-encryption backend (apps/api/src/crypto)
// and is the one env var SECURITY.md's KMS migration is meant to cost —
// it's a mode selector, not a secret, so it's allowed a default.
// CREDENTIAL_ENCRYPTION_KEY is only required when KEK_PROVIDER is "local".
const EnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(1),
    JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/, 'Expected a duration like "15m" or "7d"'),
    JWT_REFRESH_TTL: z.string().regex(/^\d+[smhd]$/, 'Expected a duration like "15m" or "7d"'),
    AGENT_SERVICE_SECRET: z.string().min(1),
    KEK_PROVIDER: z.enum(['local', 'kms']).default('local'),
    CREDENTIAL_ENCRYPTION_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.KEK_PROVIDER === 'local' && !env.CREDENTIAL_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['CREDENTIAL_ENCRYPTION_KEY'],
        message: 'Required when KEK_PROVIDER=local',
      });
    }
  });

export type ValidatedEnv = z.infer<typeof EnvSchema> & Record<string, unknown>;

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return { ...config, ...result.data };
}
