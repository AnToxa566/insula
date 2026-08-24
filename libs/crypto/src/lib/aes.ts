// AES-256-GCM primitives over WebCrypto (`crypto.subtle`). No `node:crypto`
// — this file must run identically on Cloud Run's Node runtime and inside a
// Workers V8 isolate. See envelope.ts for how these compose into the
// credential sealing scheme, and kek/local-kek-provider.ts for the one other
// caller.

import type { EncryptResult } from './types.js';

export const DEK_LENGTH = 32; // AES-256
export const IV_LENGTH = 12; // 96-bit, the size AES-GCM is designed for.
export const AUTH_TAG_LENGTH = 16; // 128-bit GCM tag.
const AUTH_TAG_LENGTH_BITS = AUTH_TAG_LENGTH * 8;

const EMPTY = new Uint8Array(0);

// The imported-key type, derived from crypto.subtle.importKey's own return
// type rather than named as `CryptoKey` directly. Without the DOM lib (this
// package targets ES2022 + WebCrypto only, no browser globals), @types/node
// declares `crypto`/`CryptoKey` as values, not types, so `CryptoKey` isn't a
// valid type reference here — and this package cannot pull in `"lib": ["dom"]`
// without also pulling in browser globals that don't exist in a Workers
// isolate. Deriving the type from the function that produces it sidesteps
// the naming collision entirely and still works under any global `crypto`
// shape (Node's, or a Workers isolate's).
export type AesKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export async function importAesKey(rawKey: Uint8Array): Promise<AesKey> {
  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// WebCrypto appends the 16-byte GCM tag to the end of the ciphertext it
// returns and expects it there again on decrypt — unlike node:crypto, which
// exposes it separately via cipher.getAuthTag(). Every caller of this module
// stores ciphertext and authTag in separate columns/fields, so encrypt()
// splits the tag off here and decrypt() re-attaches it, once, at the
// boundary — nothing downstream has to know WebCrypto packs them together.
export async function encrypt(key: AesKey, plaintext: Uint8Array, aad: Uint8Array = EMPTY): Promise<EncryptResult> {
  const iv = randomBytes(IV_LENGTH);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad, tagLength: AUTH_TAG_LENGTH_BITS },
      key,
      plaintext,
    ),
  );
  const authTag = sealed.subarray(sealed.length - AUTH_TAG_LENGTH);
  const ciphertext = sealed.subarray(0, sealed.length - AUTH_TAG_LENGTH);
  return { ciphertext, iv, authTag };
}

export async function decrypt(
  key: AesKey,
  ciphertext: Uint8Array,
  iv: Uint8Array,
  authTag: Uint8Array,
  aad: Uint8Array = EMPTY,
): Promise<Uint8Array> {
  const sealed = concatBytes(ciphertext, authTag);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: aad, tagLength: AUTH_TAG_LENGTH_BITS },
    key,
    sealed,
  );
  return new Uint8Array(plaintext);
}

// btoa/atob, not Buffer: Buffer is a Node global that doesn't exist in a
// Workers isolate. Both btoa/atob are standard and present in both runtimes.
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
