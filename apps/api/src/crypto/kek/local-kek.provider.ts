import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { KekProvider } from './kek-provider.interface.js';

const IV_LENGTH = 12; // 96-bit, the size AES-GCM is designed for.
const AUTH_TAG_LENGTH = 16;

// Development / v0 KEK: AES-256-GCM with a key from CREDENTIAL_ENCRYPTION_KEY.
// wrap() output packs iv + authTag + ciphertext into one Buffer so the
// AgentCredential row only needs to store `encryptedDek`, not three more
// columns for the DEK's own IV/tag.
export class LocalKekProvider implements KekProvider {
  readonly version = 'local-v1';
  private readonly kek: Buffer;

  constructor(base64Kek: string) {
    const kek = Buffer.from(base64Kek, 'base64');
    if (kek.length !== 32) {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEY must base64-decode to exactly 32 bytes for AES-256-GCM',
      );
    }
    this.kek = kek;
  }

  async wrap(dek: Buffer): Promise<Buffer> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.kek, iv);
    const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]);
  }

  async unwrap(wrapped: Buffer, version: string): Promise<Buffer> {
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
    const decipher = createDecipheriv('aes-256-gcm', this.kek, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}
