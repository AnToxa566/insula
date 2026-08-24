import { Inject, Injectable } from '@nestjs/common';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { KekProvider } from './kek/kek-provider.interface.js';
import { KEK_PROVIDER } from './kek/kek-provider.token.js';

const DEK_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // 96-bit, the size AES-GCM is designed for.

// Typed as Uint8Array<ArrayBuffer>, not Buffer, purely to match what Prisma's
// generated client expects for `Bytes` columns — see toPrismaBytes() below
// for why the values underneath are still ordinary Node Buffers.
export interface EncryptedCredential {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  authTag: Uint8Array<ArrayBuffer>;
  encryptedDek: Uint8Array<ArrayBuffer>;
  kekVersion: string;
  last4: string;
}

// The stored-row shape decrypt() needs — matches AgentCredential's
// encryption columns, kept as a plain interface here so this module has no
// dependency on the agent module or @insula/db's generated types (crypto is
// infrastructure, not agent logic — see AGENTS.md).
export interface EncryptedCredentialRow {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
  encryptedDek: Uint8Array;
  kekVersion: string;
}

// Full envelope scheme: a random per-credential DEK encrypts the API key
// with AES-256-GCM, the DEK itself is wrapped by the active KekProvider, and
// AAD binds the ciphertext to (userId, agentId) so a row copied to a
// different agent fails the GCM tag check instead of silently decrypting.
//
// The decrypted key this service returns exists only for the caller's local
// variable — see SECURITY.md's "Plaintext handling" checklist. Callers must
// not put it on a DTO, log it, or cache it anywhere.
@Injectable()
export class CredentialEncryptionService {
  constructor(@Inject(KEK_PROVIDER) private readonly kekProvider: KekProvider) {}

  async encrypt(userId: string, agentId: string, apiKey: string): Promise<EncryptedCredential> {
    const dek = randomBytes(DEK_LENGTH);
    try {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv('aes-256-gcm', dek, iv);
      cipher.setAAD(buildAad(userId, agentId));
      const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const encryptedDek = await this.kekProvider.wrap(dek);

      return {
        ciphertext: toPrismaBytes(ciphertext),
        iv: toPrismaBytes(iv),
        authTag: toPrismaBytes(authTag),
        encryptedDek: toPrismaBytes(encryptedDek),
        kekVersion: this.kekProvider.version,
        last4: apiKey.slice(-4),
      };
    } finally {
      dek.fill(0);
    }
  }

  async decrypt(userId: string, agentId: string, row: EncryptedCredentialRow): Promise<string> {
    const dek = Buffer.from(await this.kekProvider.unwrap(Buffer.from(row.encryptedDek), row.kekVersion));
    try {
      const decipher = createDecipheriv('aes-256-gcm', dek, Buffer.from(row.iv));
      decipher.setAAD(buildAad(userId, agentId));
      decipher.setAuthTag(Buffer.from(row.authTag));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(row.ciphertext)),
        decipher.final(),
      ]);
      return plaintext.toString('utf8');
    } finally {
      dek.fill(0);
    }
  }
}

// JSON rather than a delimited string: userId and agentId are UUIDs, so
// collision isn't realistically reachable either way, but JSON keeps the
// AAD unambiguous without relying on that.
function buildAad(userId: string, agentId: string): Buffer {
  return Buffer.from(JSON.stringify({ userId, agentId }), 'utf8');
}

// Node types Buffer as Uint8Array<ArrayBufferLike> (ArrayBuffer |
// SharedArrayBuffer), because a Buffer can in principle wrap a
// SharedArrayBuffer. Prisma's generated client types `Bytes` columns as the
// narrower Uint8Array<ArrayBuffer>, so a plain Buffer doesn't satisfy it —
// TS2322 at every call site that writes ciphertext/iv/authTag/encryptedDek.
// Every buffer that reaches this function comes from randomBytes(),
// Buffer.concat(), or a cipher's update()/getAuthTag() — none of which ever
// allocate on a SharedArrayBuffer — so the mismatch is a type-modeling gap,
// not a real risk, and asserting it away here is safe. Doing it once, at
// the boundary where these values leave the crypto module, means nothing
// downstream (agents.service.ts) needs its own cast.
function toPrismaBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  return buffer as unknown as Uint8Array<ArrayBuffer>;
}
