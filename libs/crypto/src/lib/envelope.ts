import { DEK_LENGTH, decrypt, encrypt, importAesKey, randomBytes } from './aes.js';
import type { KekProvider } from './kek/kek-provider.js';
import type { SealedCredential } from './types.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Full envelope scheme: a random per-credential DEK encrypts the plaintext
// with AES-256-GCM, the DEK itself is wrapped by the given KekProvider, and
// `aad` is bound into the GCM authenticated data — callers pass userId +
// agentId (see CryptoService in apps/api) so a row copied to a different
// agent fails the GCM tag check instead of silently decrypting.
//
// The decrypted value openCredential() returns exists only for the caller's
// local variable — see SECURITY.md's "Plaintext handling" checklist.
// Callers must not put it on a DTO, log it, or cache it anywhere.
// The AAD every credential is sealed under. The API seals and the agent
// runtime opens, in two different runtimes — building the string in one
// shared place means the two can't drift apart and silently fail the GCM
// tag check. JSON rather than a delimited string: userId and agentId are
// UUIDs, so collision isn't realistically reachable either way, but JSON
// keeps the AAD unambiguous without relying on that.
export function credentialAad(userId: string, agentId: string): string {
  return JSON.stringify({ userId, agentId });
}

export async function sealCredential(
  plaintext: string,
  aad: string,
  kek: KekProvider,
): Promise<SealedCredential> {
  const dek = randomBytes(DEK_LENGTH);
  try {
    const key = await importAesKey(dek);
    const { ciphertext, iv, authTag } = await encrypt(key, textEncoder.encode(plaintext), textEncoder.encode(aad));
    const encryptedDek = await kek.wrap(dek);

    return { ciphertext, iv, authTag, encryptedDek, kekVersion: kek.version };
  } finally {
    dek.fill(0);
  }
}

export async function openCredential(
  sealed: SealedCredential,
  aad: string,
  kek: KekProvider,
): Promise<string> {
  const dek = await kek.unwrap(sealed.encryptedDek, sealed.kekVersion);
  try {
    const key = await importAesKey(dek);
    const plaintext = await decrypt(key, sealed.ciphertext, sealed.iv, sealed.authTag, textEncoder.encode(aad));
    return textDecoder.decode(plaintext);
  } finally {
    dek.fill(0);
  }
}
