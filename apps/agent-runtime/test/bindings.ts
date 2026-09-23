// Test-only values, shared by vitest.config.ts (Node) and the specs
// (workerd). None of these is a real secret.
export const TEST_BINDINGS = {
  AGENT_SERVICE_SECRET: 'test-agent-service-secret',
  // The KEK from libs/crypto's envelope fixture — a published test value.
  CREDENTIAL_ENCRYPTION_KEY: 'lfMtxUSrOVaCGflhvG0iJVPIOVzvqSnT1Y/ovhIl4n8=',
  CORE_API_URL: 'http://core.test/api',
  RUNTIME_SECRET: 'test-runtime-secret-0123456789abcdef',
} as const;
