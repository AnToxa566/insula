import { Logger } from '@nestjs/common';

import { MailTransport, type MailMessage } from '../mail-transport.js';

// Dev/test transport: sends nothing. Logs the template name and a masked
// recipient only — never the subject or body, because the body of a
// password-reset mail is the verification code and "never log codes" holds in
// dev too. To exercise the flow by hand, use the Brevo transport or overwrite
// the stored code hash in the database.
export class ConsoleMailTransport extends MailTransport {
  private readonly logger = new Logger('MailTransport');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`MAIL_CONSOLE template=${message.template} to=${maskEmail(message.to)}`);
  }
}

// "alice@example.com" -> "a***@example.com"
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}
