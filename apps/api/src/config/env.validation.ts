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
//
// MAIL_TRANSPORT selects the mail backend (apps/api/src/mail): "console" is
// the dev/test default and sends nothing; "brevo" needs BREVO_API_KEY (a
// secret — Secret Manager in production, never logged) and a MAIL_FROM_EMAIL
// that Brevo has verified as a sender. TRUST_PROXY_HOPS is how many reverse
// proxies sit in front of the API (1 on Cloud Run) so per-IP rate limits see
// the real client address; 0 leaves Express's default of trusting none.
const EnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(1),
    JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/, 'Expected a duration like "15m" or "7d"'),
    JWT_REFRESH_TTL: z.string().regex(/^\d+[smhd]$/, 'Expected a duration like "15m" or "7d"'),
    AGENT_SERVICE_SECRET: z.string().min(1),
    KEK_PROVIDER: z.enum(['local', 'kms']).default('local'),
    CREDENTIAL_ENCRYPTION_KEY: z.string().min(1).optional(),
    // The web client's origin, for CORS — a config default like
    // KEK_PROVIDER, not a secret. apps/web runs on :3000 by default; the
    // API is on a different port (:3333), so without this every browser
    // request from the web app fails CORS before it reaches a route.
    WEB_APP_URL: z.string().min(1).default('http://localhost:3000'),
    MAIL_TRANSPORT: z.enum(['console', 'brevo']).default('console'),
    BREVO_API_KEY: z.string().min(1).optional(),
    MAIL_FROM_EMAIL: z.email().optional(),
    MAIL_FROM_NAME: z.string().min(1).default('Insula'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((env, ctx) => {
    if (env.KEK_PROVIDER === 'local' && !env.CREDENTIAL_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['CREDENTIAL_ENCRYPTION_KEY'],
        message: 'Required when KEK_PROVIDER=local',
      });
    }
    if (env.MAIL_TRANSPORT === 'brevo') {
      if (!env.BREVO_API_KEY) {
        ctx.addIssue({
          code: 'custom',
          path: ['BREVO_API_KEY'],
          message: 'Required when MAIL_TRANSPORT=brevo',
        });
      }
      if (!env.MAIL_FROM_EMAIL) {
        ctx.addIssue({
          code: 'custom',
          path: ['MAIL_FROM_EMAIL'],
          message: 'Required when MAIL_TRANSPORT=brevo',
        });
      }
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
