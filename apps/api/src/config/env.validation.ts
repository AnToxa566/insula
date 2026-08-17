import { z } from 'zod';

// Fails fast at boot if any of these are missing or empty. No default is
// ever substituted here — a missing secret must crash the process, not fall
// back to something insecure. JWT_REFRESH_SECRET is deliberately absent:
// the refresh token is 32 random bytes hashed with SHA-256, not a JWT, so
// nothing ever reads that secret.
const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/, 'Expected a duration like "15m" or "7d"'),
  JWT_REFRESH_TTL: z.string().regex(/^\d+[smhd]$/, 'Expected a duration like "15m" or "7d"'),
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
