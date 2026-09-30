import { Injectable, Logger } from '@nestjs/common';

import { MailDeliveryError, MailTransport, type MailMessage } from './mail-transport.js';
import { renderPasswordChanged } from './templates/password-changed.template.js';
import { renderPasswordResetCode } from './templates/password-reset-code.template.js';

// Shown in the mail body only; the code's real TTL is enforced by
// auth/password-reset.constants.ts. Duplicated rather than imported because
// mail is infrastructure and must not depend on the auth module.
const CODE_TTL_MINUTES = 10;

// Intent-level API: callers say *what* happened, not how to deliver it, and
// get no result back. That keeps this swappable for a Pub/Sub publish later
// and lets callers fire-and-forget.
//
// Every method NEVER throws. A mail failure must not fail (or change the
// timing of) a request whose response is deliberately identical for known and
// unknown emails — and a rejected promise nobody awaits would crash the
// process. Failures log the template name and status only: never the
// recipient, the code, the body, the API key, or the raw error.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly transport: MailTransport) {}

  sendPasswordResetCode(to: string, code: string): Promise<void> {
    return this.deliver(renderPasswordResetCode(to, code, CODE_TTL_MINUTES));
  }

  sendPasswordChanged(to: string): Promise<void> {
    return this.deliver(renderPasswordChanged(to));
  }

  private async deliver(message: MailMessage): Promise<void> {
    try {
      await this.transport.send(message);
    } catch (error) {
      const status = error instanceof MailDeliveryError ? (error.status ?? 'none') : 'unknown';
      this.logger.warn(`MAIL_SEND_FAILED template=${message.template} status=${status}`);
    }
  }
}
