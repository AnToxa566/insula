import { ConfigService } from '@nestjs/config';

import { createMailTransport } from './mail-transport.factory.js';
import { BrevoMailTransport } from './transports/brevo.transport.js';
import { ConsoleMailTransport } from './transports/console.transport.js';

const config = (values: Record<string, unknown>) => new ConfigService(values);

describe('createMailTransport', () => {
  it('selects the console transport by default', () => {
    expect(createMailTransport(config({}))).toBeInstanceOf(ConsoleMailTransport);
  });

  it('selects the console transport for MAIL_TRANSPORT=console', () => {
    expect(createMailTransport(config({ MAIL_TRANSPORT: 'console' }))).toBeInstanceOf(
      ConsoleMailTransport,
    );
  });

  it('selects the Brevo transport for MAIL_TRANSPORT=brevo', () => {
    const transport = createMailTransport(
      config({
        MAIL_TRANSPORT: 'brevo',
        BREVO_API_KEY: 'xkeysib-test',
        MAIL_FROM_EMAIL: 'no-reply@insula.app',
      }),
    );
    expect(transport).toBeInstanceOf(BrevoMailTransport);
  });

  it('throws when brevo is selected without its settings', () => {
    expect(() => createMailTransport(config({ MAIL_TRANSPORT: 'brevo' }))).toThrow();
  });

  it('throws on an unknown transport', () => {
    expect(() => createMailTransport(config({ MAIL_TRANSPORT: 'smtp' }))).toThrow(
      /Unknown MAIL_TRANSPORT/,
    );
  });
});
