import {
  AUTH_TAG_LENGTH,
  IV_LENGTH,
  base64ToBytes,
  concatBytes,
  decrypt,
  encrypt,
  importAesKey,
  type AesKey,
} from '../aes.js';
import type { KekProvider } from './kek-provider.js';

// Development / v0 KEK: AES-256-GCM with a key passed in by the caller
// (never read from the environment here — see the library's constraints).
// wrap() output packs iv + authTag + ciphertext into one blob so the
// AgentCredential row only needs to store `encryptedDek`, not three more
// columns for the DEK's own IV/tag. This layout predates the WebCrypto
// migration and is preserved byte-for-byte so existing rows keep decrypting
// — see the module-level comment in aes.ts on tag placement.
export class LocalKekProvider implements KekProvider {
  readonly version = 'local-v1';
  private readonly key: Promise<AesKey>;

  constructor(base64Kek: string) {
    const raw = base64ToBytes(base64Kek);
    if (raw.length !== 32) {
      throw new Error(
        'LocalKekProvider key must base64-decode to exactly 32 bytes for AES-256-GCM',
      );
    }
    this.key = importAesKey(raw);
  }

  async wrap(dek: Uint8Array): Promise<Uint8Array> {
    const key = await this.key;
    const { ciphertext, iv, authTag } = await encrypt(key, dek);
    return concatBytes(iv, authTag, ciphertext);
  }

  async unwrap(wrapped: Uint8Array, version: string): Promise<Uint8Array> {
    if (version !== this.version) {
      // Deliberately does not attempt to decrypt anyway — a version
      // mismatch means this provider does not know the key/format that
      // produced `wrapped`, and guessing would be a silent-corruption risk.
      throw new Error(
        `LocalKekProvider cannot unwrap a DEK wrapped under kekVersion "${version}" (this provider only handles "${this.version}")`,
      );
    }
    const iv = wrapped.subarray(0, IV_LENGTH);
    const authTag = wrapped.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = wrapped.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const key = await this.key;
    return decrypt(key, ciphertext, iv, authTag);
  }
}
