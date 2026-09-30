import { Logger } from '@nestjs/common';

import { renderPasswordResetCode } from '../templates/password-reset-code.template.js';
import { ConsoleMailTransport, maskEmail } from './console.transport.js';

describe('maskEmail', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmail('alice@example.com')).toBe('a***@example.com');
  });

  it('fully masks a malformed address', () => {
    expect(maskEmail('nonsense')).toBe('***');
    expect(maskEmail('@example.com')).toBe('***');
  });
});

describe('ConsoleMailTransport', () => {
  const spies: jest.SpyInstance[] = [];

  afterEach(() => {
    spies.splice(0).forEach((spy) => spy.mockRestore());
  });

  it('logs the template and masked recipient but never the code, subject or body', async () => {
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      spies.push(jest.spyOn(Logger.prototype, level).mockImplementation());
    }
    const message = renderPasswordResetCode('alice@example.com', '482913', 10);

    await new ConsoleMailTransport().send(message);

    const output = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(output).toContain('password-reset-code');
    expect(output).toContain('a***@example.com');
    expect(output).not.toContain('482913');
    expect(output).not.toContain('alice@');
    expect(output).not.toContain(message.subject);
  });
});
