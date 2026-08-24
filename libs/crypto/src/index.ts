export type { SealedCredential, EncryptResult } from './lib/types.js';
export { sealCredential, openCredential } from './lib/envelope.js';
export type { KekProvider } from './lib/kek/kek-provider.js';
export { LocalKekProvider } from './lib/kek/local-kek-provider.js';
