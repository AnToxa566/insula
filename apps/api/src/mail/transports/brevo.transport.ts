import { MailDeliveryError, MailTransport, type MailMessage } from '../mail-transport.js';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const REQUEST_TIMEOUT_MS = 5000;

export interface BrevoTransportOptions {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

// Brevo's transactional REST API over the global `fetch` — no SDK, so there is
// nothing to keep in step with a vendor release and nothing extra to bundle.
// The API key lives only in the `api-key` header. Failures surface as a
// MailDeliveryError carrying the HTTP status alone; the response body and the
// original error are dropped on purpose, since either could echo the request.
export class BrevoMailTransport extends MailTransport {
  constructor(private readonly options: BrevoTransportOptions) {
    super();
  }

  async send(message: MailMessage): Promise<void> {
    let response: Response;
    try {
      response = await fetch(BREVO_SEND_URL, {
        method: 'POST',
        headers: {
          'api-key': this.options.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: this.options.fromEmail, name: this.options.fromName },
          to: [{ email: message.to }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new MailDeliveryError(null);
    }

    if (!response.ok) {
      throw new MailDeliveryError(response.status);
    }
  }
}
