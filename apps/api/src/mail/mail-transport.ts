// A fully rendered outbound email. `template` is the template's name, carried
// alongside the content only so transports can log *which* mail was sent
// without ever touching the subject or body (which may hold a one-time code).
export interface MailMessage {
  to: string;
  template: string;
  subject: string;
  text: string;
  html: string;
}

// Thrown by a transport when delivery fails. Deliberately carries nothing but
// a status: the provider's response body and our request (which holds the API
// key and the mail content) must never end up in a log line or an error
// message. `status` is the HTTP status, or null when no response arrived
// (network failure, timeout).
export class MailDeliveryError extends Error {
  constructor(readonly status: number | null) {
    super('Mail delivery failed');
    this.name = 'MailDeliveryError';
  }
}

// Abstract class rather than an interface so it doubles as the Nest DI token.
export abstract class MailTransport {
  abstract send(message: MailMessage): Promise<void>;
}
