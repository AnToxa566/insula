import { base64ToBytes, credentialAad, LocalKekProvider, openCredential } from '@insula/crypto';

import type { RuntimeResponse } from '../api/schemas.js';

// Unwraps the sealed credential GET /agents/:id/runtime returned. The AAD
// binds the ciphertext to (owner, agent), so a credential row moved to
// another agent fails the GCM tag check here instead of decrypting.
//
// The returned plaintext is the user's provider key. It must stay in the
// caller's local scope for one cycle: never setState, never this.sql, never
// a class field, never a log line. It's fetched and unwrapped again on the
// next wake.
export async function openRuntimeCredential(
  credential: RuntimeResponse['credential'],
  ownerId: string,
  agentId: string,
  kekBase64: string,
): Promise<string> {
  return openCredential(
    {
      ciphertext: base64ToBytes(credential.ciphertext),
      iv: base64ToBytes(credential.iv),
      authTag: base64ToBytes(credential.authTag),
      encryptedDek: base64ToBytes(credential.encryptedDek),
      kekVersion: credential.kekVersion,
    },
    credentialAad(ownerId, agentId),
    new LocalKekProvider(kekBase64),
  );
}
