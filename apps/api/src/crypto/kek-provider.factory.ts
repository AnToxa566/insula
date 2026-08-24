import { ConfigService } from '@nestjs/config';

import { LocalKekProvider, type KekProvider } from '@insula/crypto';

import { KmsKekProvider } from './kms-kek-provider.js';

// Selects the active KekProvider from KEK_PROVIDER. This is the one env var
// a KEK migration is meant to cost — see the comment on KEK_PROVIDER in
// env.validation.ts and SECURITY.md. Reading configuration is deliberately
// this factory's job, not @insula/crypto's — the library takes keys as
// constructor arguments and never reads the environment itself.
export function createKekProvider(config: ConfigService): KekProvider {
  const mode = config.get<string>('KEK_PROVIDER', 'local');

  switch (mode) {
    case 'local':
      return new LocalKekProvider(config.getOrThrow<string>('CREDENTIAL_ENCRYPTION_KEY'));
    case 'kms':
      return new KmsKekProvider();
    default:
      throw new Error(`Unknown KEK_PROVIDER "${mode}" — expected "local" or "kms"`);
  }
}
