import { Inject, Injectable } from '@nestjs/common';

import {
  credentialAad,
  openCredential,
  sealCredential,
  type KekProvider,
  type SealedCredential,
} from '@insula/crypto';

import { KEK_PROVIDER } from './kek-provider.token.js';

// Typed as Uint8Array<ArrayBuffer>, not Uint8Array<ArrayBufferLike>, purely
// to match what Prisma's generated client expects for `Bytes` columns — see
// toPrismaBytes() below for why the values underneath satisfy this either
// way.
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

// Thin Nest wrapper around @insula/crypto: this class owns picking the KEK
// provider and reading config (both app concerns), and delegates the actual
// envelope encryption to the shared library so the same sealing/opening
// code can run unmodified in the future agent runtime. Nothing here should
// grow real cryptography — that belongs in the library.
//
// The decrypted key decrypt() returns exists only for the caller's local
// variable — see SECURITY.md's "Plaintext handling" checklist. Callers must
// not put it on a DTO, log it, or cache it anywhere.
@Injectable()
export class CryptoService {
  constructor(@Inject(KEK_PROVIDER) private readonly kekProvider: KekProvider) {}

  async encrypt(userId: string, agentId: string, apiKey: string): Promise<EncryptedCredential> {
    const sealed = await sealCredential(apiKey, credentialAad(userId, agentId), this.kekProvider);

    return {
      ciphertext: toPrismaBytes(sealed.ciphertext),
      iv: toPrismaBytes(sealed.iv),
      authTag: toPrismaBytes(sealed.authTag),
      encryptedDek: toPrismaBytes(sealed.encryptedDek),
      kekVersion: sealed.kekVersion,
      last4: apiKey.slice(-4),
    };
  }

  async decrypt(userId: string, agentId: string, row: EncryptedCredentialRow): Promise<string> {
    return openCredential(toSealedCredential(row), credentialAad(userId, agentId), this.kekProvider);
  }
}

function toSealedCredential(row: EncryptedCredentialRow): SealedCredential {
  return {
    ciphertext: row.ciphertext,
    iv: row.iv,
    authTag: row.authTag,
    encryptedDek: row.encryptedDek,
    kekVersion: row.kekVersion,
  };
}

// See the comment on EncryptedCredential above: every byte array reaching
// this function comes out of WebCrypto (crypto.subtle.encrypt or
// getRandomValues, by way of @insula/crypto), none of which ever allocate
// on a SharedArrayBuffer, so the assertion is safe. Doing it once, at the
// boundary where these values leave the crypto module, means nothing
// downstream (agents.service.ts) needs its own cast.
function toPrismaBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes as Uint8Array<ArrayBuffer>;
}
