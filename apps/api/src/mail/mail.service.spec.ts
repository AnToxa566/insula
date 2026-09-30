import { Logger } from '@nestjs/common';

import { MailService } from './mail.service.js';
import { MailDeliveryError, type MailMessage, type MailTransport } from './mail-transport.js';
import { BrevoMailTransport } from './transports/brevo.transport.js';

const API_KEY = 'xkeysib-test-secret-key';
const CODE = '482913';

describe('MailService', () => {
  const spies: jest.SpyInstance[] = [];
  const originalFetch = global.fetch;

  function spyOnLogger(): () => string {
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      spies.push(jest.spyOn(Logger.prototype, level).mockImplementation());
    }
    return () => JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
  }

  afterEach(() => {
    spies.splice(0).forEach((spy) => spy.mockRestore());
    global.fetch = originalFetch;
  });

  it('hands the rendered reset-code mail to the transport', async () => {
    const send = jest.fn<Promise<void>, [MailMessage]>().mockResolvedValue();
    const service = new MailService({ send } as MailTransport);

    await service.sendPasswordResetCode('alice@example.com', CODE);

    const message = send.mock.calls[0][0];
    expect(message.to).toBe('alice@example.com');
    expect(message.template).toBe('password-reset-code');
    expect(message.text).toContain(CODE);
    expect(message.html).toContain(CODE);
  });

  it('hands the rendered password-changed mail to the transport', async () => {
    const send = jest.fn<Promise<void>, [MailMessage]>().mockResolvedValue();
    const service = new MailService({ send } as MailTransport);

    await service.sendPasswordChanged('alice@example.com');

    expect(send.mock.calls[0][0]).toEqual(
      expect.objectContaining({ to: 'alice@example.com', template: 'password-changed' }),
    );
  });

  it('never rejects when the transport throws, and logs only template and status', async () => {
    const logged = spyOnLogger();
    const send = jest.fn().mockRejectedValue(new MailDeliveryError(503));
    const service = new MailService({ send } as MailTransport);

    await expect(service.sendPasswordResetCode('alice@example.com', CODE)).resolves.toBeUndefined();

    expect(logged()).toContain('MAIL_SEND_FAILED template=password-reset-code status=503');
    expect(logged()).not.toContain(CODE);
    expect(logged()).not.toContain('alice@');
  });

  it('never rejects on an unexpected error type and does not log the raw error', async () => {
    const logged = spyOnLogger();
    const send = jest.fn().mockRejectedValue(new Error(`boom ${API_KEY} ${CODE}`));
    const service = new MailService({ send } as MailTransport);

    await expect(service.sendPasswordChanged('alice@example.com')).resolves.toBeUndefined();

    expect(logged()).toContain('MAIL_SEND_FAILED template=password-changed status=unknown');
    expect(logged()).not.toContain(API_KEY);
    expect(logged()).not.toContain(CODE);
  });

  it('logs neither the API key nor the code when the Brevo call fails end to end', async () => {
    const logged = spyOnLogger();
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(`{"echo":"${API_KEY} ${CODE}"}`, { status: 401 }),
      ) as unknown as typeof fetch;
    const service = new MailService(
      new BrevoMailTransport({
        apiKey: API_KEY,
        fromEmail: 'no-reply@insula.app',
        fromName: 'Insula',
      }),
    );

    await expect(service.sendPasswordResetCode('alice@example.com', CODE)).resolves.toBeUndefined();

    expect(logged()).toContain('status=401');
    expect(logged()).not.toContain(API_KEY);
    expect(logged()).not.toContain(CODE);
  });

  it('logs neither the API key nor the code when the Brevo call fails at the network level', async () => {
    const logged = spyOnLogger();
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error(`socket hang up ${API_KEY}`)) as unknown as typeof fetch;
    const service = new MailService(
      new BrevoMailTransport({
        apiKey: API_KEY,
        fromEmail: 'no-reply@insula.app',
        fromName: 'Insula',
      }),
    );

    await expect(service.sendPasswordResetCode('alice@example.com', CODE)).resolves.toBeUndefined();

    expect(logged()).toContain('status=none');
    expect(logged()).not.toContain(API_KEY);
    expect(logged()).not.toContain(CODE);
  });
});
