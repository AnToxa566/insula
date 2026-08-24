import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CryptoService } from './crypto.service.js';
import { createKekProvider } from './kek-provider.factory.js';
import { KEK_PROVIDER } from './kek-provider.token.js';

// Infrastructure, not agent logic — must not import from ../agent. Anything
// that needs to encrypt or decrypt a stored credential imports
// CryptoService from here. The envelope encryption itself lives in
// @insula/crypto (shared with the future agent runtime); this module's job
// is just picking a KekProvider from config and wiring it up for Nest DI.
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KEK_PROVIDER,
      inject: [ConfigService],
      useFactory: createKekProvider,
    },
    CryptoService,
  ],
  exports: [CryptoService],
})
export class CryptoModule {}
