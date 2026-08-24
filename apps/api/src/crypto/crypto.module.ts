import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CredentialEncryptionService } from './credential-encryption.service.js';
import { createKekProvider } from './kek/kek-provider.factory.js';
import { KEK_PROVIDER } from './kek/kek-provider.token.js';

// Infrastructure, not agent logic — must not import from ../agent. Anything
// that needs to encrypt or decrypt a stored credential imports
// CredentialEncryptionService from here.
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KEK_PROVIDER,
      inject: [ConfigService],
      useFactory: createKekProvider,
    },
    CredentialEncryptionService,
  ],
  exports: [CredentialEncryptionService],
})
export class CryptoModule {}
