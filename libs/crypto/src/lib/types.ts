// A credential sealed for storage: a per-credential DEK encrypted the
// plaintext, and the DEK itself was wrapped by a KekProvider. Field names
// match the AgentCredential columns this maps onto 1:1 — see envelope.ts.
export interface SealedCredential {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
  encryptedDek: Uint8Array;
  kekVersion: string;
}

// The raw output of one AES-256-GCM encrypt call, before it's assembled
// into a SealedCredential (envelope.ts) or a KekProvider's own wrap() blob
// (kek/local-kek-provider.ts).
export interface EncryptResult {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
}
