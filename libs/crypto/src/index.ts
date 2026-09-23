export type { SealedCredential, EncryptResult } from './lib/types.js';
export { sealCredential, openCredential, credentialAad } from './lib/envelope.js';
// Standard (padded) base64 — the wire format GET /agents/:id/runtime uses
// for sealed credential fields.
export { base64ToBytes, bytesToBase64 } from './lib/aes.js';
export type { KekProvider } from './lib/kek/kek-provider.js';
export { LocalKekProvider } from './lib/kek/local-kek-provider.js';
