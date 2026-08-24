import { openCredential } from './envelope.js';
import { LocalKekProvider } from './kek/local-kek-provider.js';
import type { SealedCredential } from './types.js';

// A credential sealed by the pre-migration node:crypto implementation
// (CredentialEncryptionService + LocalKekProvider, both using
// createCipheriv('aes-256-gcm', ...)), captured as a fixed byte fixture.
// node:crypto exposes the GCM tag separately via cipher.getAuthTag(); this
// fixture's `ciphertext` and `authTag` fields, and the authTag packed
// inside `encryptedDek`, are exactly what that produced.
//
// This test pins the WebCrypto rewrite to the same byte layout: WebCrypto
// appends the tag to the ciphertext instead of returning it separately, so
// getting the split/concat wrong here would make row still "work" in
// isolation (round-trip tests would pass) while failing on data written by
// the code this replaced. See aes.ts's module comment for the mechanics.
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const KEK_BASE64 = 'lfMtxUSrOVaCGflhvG0iJVPIOVzvqSnT1Y/ovhIl4n8=';
const USER_ID = 'user-1';
const AGENT_ID = 'agent-1';
const PLAINTEXT = 'sk-ant-fixture-secret-0001';

const FIXTURE: SealedCredential = {
  ciphertext: hexToBytes('374a9546b81663fc2c6e2801152d97e48fa3a730da64fb40bb1d'),
  iv: hexToBytes('6ff0a31986b67d28b5efafb7'),
  authTag: hexToBytes('d6b4a6fe34a022aadce8ff8523a96220'),
  encryptedDek: hexToBytes(
    '075acea23c3ae6a351ca3fadb74066b5f0b813eff2e78686c1d4d4085be966e4557dd1e860b325597bbd568409efd1c605e4d2cb663a3f702f96cc9b',
  ),
  kekVersion: 'local-v1',
};

describe('envelope fixture (pre-migration node:crypto row)', () => {
  it('still opens under the WebCrypto implementation', async () => {
    const kek = new LocalKekProvider(KEK_BASE64);
    const aad = JSON.stringify({ userId: USER_ID, agentId: AGENT_ID });

    const opened = await openCredential(FIXTURE, aad, kek);

    expect(opened).toBe(PLAINTEXT);
  });
});
