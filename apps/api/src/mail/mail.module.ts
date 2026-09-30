import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MailService } from './mail.service.js';
import { createMailTransport } from './mail-transport.factory.js';
import { MailTransport } from './mail-transport.js';

// Infrastructure, same pattern as crypto/ and idempotency/ — must not import
// from ../auth or any other feature module. Callers depend on MailService's
// intent-level methods only, so the transport (console, Brevo, a future
// queue) is picked here from config and invisible to them.
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MailTransport,
      inject: [ConfigService],
      useFactory: createMailTransport,
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
