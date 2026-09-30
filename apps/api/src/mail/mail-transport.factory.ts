import { ConfigService } from '@nestjs/config';

import { MailTransport } from './mail-transport.js';
import { BrevoMailTransport } from './transports/brevo.transport.js';
import { ConsoleMailTransport } from './transports/console.transport.js';

// Selects the active MailTransport from MAIL_TRANSPORT. Same shape as
// crypto/kek-provider.factory.ts: reading configuration is this factory's
// job, the transports take plain constructor arguments. env.validation.ts
// already guarantees BREVO_API_KEY and MAIL_FROM_EMAIL exist when the mode is
// "brevo"; getOrThrow is the second line of defence for anything that builds
// a ConfigService without going through validation.
export function createMailTransport(config: ConfigService): MailTransport {
  const mode = config.get<string>('MAIL_TRANSPORT', 'console');

  switch (mode) {
    case 'console':
      return new ConsoleMailTransport();
    case 'brevo':
      return new BrevoMailTransport({
        apiKey: config.getOrThrow<string>('BREVO_API_KEY'),
        fromEmail: config.getOrThrow<string>('MAIL_FROM_EMAIL'),
        fromName: config.get<string>('MAIL_FROM_NAME', 'Insula'),
      });
    default:
      throw new Error(`Unknown MAIL_TRANSPORT "${mode}" — expected "console" or "brevo"`);
  }
}
