import { z } from 'zod';

import { base64ToBytes } from '@insula/crypto';

import type { InsulaAgent } from './agent.js';

// Bindings and secrets, declared by hand rather than generated: `wrangler
// types` would derive the secret names from each developer's local
// .dev.vars, so the type would depend on whose machine ran it. env.d.ts
// holds the generated *runtime* types only (see the cf-typegen target).
export interface Env {
  InsulaAgent: DurableObjectNamespace<InsulaAgent>;
  AGENT_SERVICE_SECRET: string;
  CREDENTIAL_ENCRYPTION_KEY: string;
  CORE_API_URL: string;
  RUNTIME_SECRET: string;
}

export interface RuntimeConfig {
  agentServiceSecret: string;
  // Base64; must decode to 32 bytes — the same KEK the API seals with.
  kek: string;
  // No trailing slash; includes the API's /api prefix.
  coreApiUrl: string;
  runtimeSecret: string;
}

function isKek(value: string): boolean {
  try {
    return base64ToBytes(value).length === 32;
  } catch {
    return false;
  }
}

const EnvSchema = z.object({
  AGENT_SERVICE_SECRET: z.string().min(1),
  CREDENTIAL_ENCRYPTION_KEY: z.string().refine(isKek),
  CORE_API_URL: z.url({ protocol: /^https?$/ }),
  // Only this runtime reads it, so it can demand more than "non-empty".
  RUNTIME_SECRET: z.string().min(32),
});

// Returns null rather than throwing: a zod error would echo the offending
// values, and these are secrets. Callers answer a generic 500.
export function parseEnv(env: Env): RuntimeConfig | null {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    return null;
  }
  return {
    agentServiceSecret: parsed.data.AGENT_SERVICE_SECRET,
    kek: parsed.data.CREDENTIAL_ENCRYPTION_KEY,
    coreApiUrl: parsed.data.CORE_API_URL.replace(/\/+$/, ''),
    runtimeSecret: parsed.data.RUNTIME_SECRET,
  };
}
