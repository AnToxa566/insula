import type { ProviderValidationResult } from './provider-validator.interface.js';

// apps/api-e2e drives the create-agent flow over real HTTP against a
// separately-spawned server process (nx serve, not a TestingModule), so a
// Nest `overrideProvider` in the test file can never reach it. This
// reserved key prefix lets e2e tests choose a validation outcome without a
// real provider call.
//
// Safe by construction, not by environment: the prefix is long and
// deliberately un-key-shaped (no real Anthropic/OpenAI/Google key can ever
// equal it), so this activates only when a caller explicitly opts in by
// sending it — there's nothing to accidentally trigger. See
// apps/api-e2e/src/agent/*.spec.ts for the tests that use this.
const STUB_PREFIX = 'insula-e2e-stub-';
const STUB_INVALID_KEY = `${STUB_PREFIX}invalid`;

export function stubbedValidationResult(apiKey: string): ProviderValidationResult | undefined {
  if (!apiKey.startsWith(STUB_PREFIX)) {
    return undefined;
  }
  if (apiKey === STUB_INVALID_KEY) {
    return { ok: false, message: 'stub: provider rejected this key' };
  }
  return { ok: true };
}
