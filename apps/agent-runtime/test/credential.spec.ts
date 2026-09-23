import { bytesToBase64 } from '@insula/crypto';
import { describe, expect, it } from 'vitest';

import { openRuntimeCredential } from '../src/credentials/open-credential.js';

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytesToBase64(bytes);
}

// The same sealed row libs/crypto's envelope.fixture.spec.ts pins (written
// by the API's original node:crypto implementation), re-encoded into the
// base64 wire format GET /agents/:id/runtime uses. Opening it here proves
// the runtime — in workerd, not Node — decrypts exactly what the API seals.
const KEK_BASE64 = 'lfMtxUSrOVaCGflhvG0iJVPIOVzvqSnT1Y/ovhIl4n8=';
const OWNER_ID = 'user-1';
const AGENT_ID = 'agent-1';
const PLAINTEXT = 'sk-ant-fixture-secret-0001';

const WIRE_CREDENTIAL = {
  ciphertext: hexToBase64('374a9546b81663fc2c6e2801152d97e48fa3a730da64fb40bb1d'),
  iv: hexToBase64('6ff0a31986b67d28b5efafb7'),
  authTag: hexToBase64('d6b4a6fe34a022aadce8ff8523a96220'),
  encryptedDek: hexToBase64(
    '075acea23c3ae6a351ca3fadb74066b5f0b813eff2e78686c1d4d4085be966e4557dd1e860b325597bbd568409efd1c605e4d2cb663a3f702f96cc9b',
  ),
  kekVersion: 'local-v1',
};

describe('openRuntimeCredential', () => {
  it('unwraps a sealed fixture to the expected key', async () => {
    await expect(openRuntimeCredential(WIRE_CREDENTIAL, OWNER_ID, AGENT_ID, KEK_BASE64)).resolves.toBe(PLAINTEXT);
  });

  // The AAD binds the row to (owner, agent): the same bytes presented for
  // another agent must fail the GCM tag check, not decrypt.
  it('refuses to open the credential for a different agent', async () => {
    await expect(openRuntimeCredential(WIRE_CREDENTIAL, OWNER_ID, 'agent-2', KEK_BASE64)).rejects.toThrow();
  });

  it('refuses to open the credential for a different owner', async () => {
    await expect(openRuntimeCredential(WIRE_CREDENTIAL, 'user-2', AGENT_ID, KEK_BASE64)).rejects.toThrow();
  });
});
