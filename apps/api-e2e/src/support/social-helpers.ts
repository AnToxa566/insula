import { E2E_EMAIL_PREFIX, registerTestUser, uniqueTestIdentity } from './auth-helpers';
import type { RegisterResult, TestIdentity } from './auth-helpers';

// Registers a test user whose email carries the given prefix instead of the
// shared auth-suite prefix, so each social spec file's own afterAll cleanup
// (`deleteMany({ where: { email: { startsWith: <its own prefix> } } })`)
// only ever touches rows that file created — safe under Jest's parallel
// workers sharing one dev Postgres.
export function registerSocialUser(
  prefix: string,
  overrides: Partial<TestIdentity> = {},
): Promise<RegisterResult> {
  const base = uniqueTestIdentity();
  return registerTestUser({
    ...base,
    email: base.email.replace(E2E_EMAIL_PREFIX, prefix),
    ...overrides,
  });
}

export function authHeader(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}
