import axios from 'axios';

// Shared prefix so auth.spec.ts's afterAll cleanup can target exactly (and
// only) the rows this suite created, and so reruns against the shared dev
// Postgres never collide with real Postman data.
export const E2E_EMAIL_PREFIX = 'e2e-auth-';

// Exported so other *-helpers files (e.g. agent-helpers.ts) can build
// collision-free fixtures without duplicating this format.
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export interface TestIdentity {
  email: string;
  password: string;
  handle: string;
  displayName: string;
}

export function uniqueTestIdentity(): TestIdentity {
  const suffix = uniqueSuffix();
  return {
    email: `${E2E_EMAIL_PREFIX}${suffix}@example.com`,
    password: 'correct-horse-battery-staple',
    handle: `e2e${suffix}`, // lowercase alphanumeric, well under the 20-char limit
    displayName: 'E2E Auth Test',
  };
}

export interface RegisterResult {
  identity: TestIdentity;
  data: {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; profile: Record<string, unknown> };
  };
}

export async function registerTestUser(
  overrides: Partial<TestIdentity> = {},
): Promise<RegisterResult> {
  const identity = { ...uniqueTestIdentity(), ...overrides };
  const res = await axios.post('/api/auth/register', identity);
  return { identity, data: res.data };
}
