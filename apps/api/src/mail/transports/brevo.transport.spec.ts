import { MailDeliveryError, type MailMessage } from '../mail-transport.js';
import { BrevoMailTransport } from './brevo.transport.js';

const API_KEY = 'xkeysib-test-secret-key';

const message: MailMessage = {
  to: 'alice@example.com',
  template: 'password-reset-code',
  subject: 'Subject line',
  text: 'plain body',
  html: '<p>html body</p>',
};

function makeTransport(): BrevoMailTransport {
  return new BrevoMailTransport({
    apiKey: API_KEY,
    fromEmail: 'no-reply@insula.app',
    fromName: 'Insula',
  });
}

describe('BrevoMailTransport', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs to the Brevo SMTP endpoint with the api-key header and JSON body', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));

    await makeTransport().send(message);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(
      expect.objectContaining({
        'api-key': API_KEY,
        'content-type': 'application/json',
      }),
    );
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { email: 'no-reply@insula.app', name: 'Insula' },
      to: [{ email: 'alice@example.com' }],
      subject: 'Subject line',
      htmlContent: '<p>html body</p>',
      textContent: 'plain body',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not put the API key in the request body', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));

    await makeTransport().send(message);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body as string).not.toContain(API_KEY);
  });

  it('throws a MailDeliveryError carrying only the status on a non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      new Response(`{"message":"bad key ${API_KEY}"}`, { status: 401 }),
    );

    const error = await makeTransport()
      .send(message)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MailDeliveryError);
    expect((error as MailDeliveryError).status).toBe(401);
    expect((error as MailDeliveryError).message).not.toContain(API_KEY);
  });

  it('throws a MailDeliveryError with a null status on a network failure, dropping the cause', async () => {
    fetchMock.mockRejectedValue(new Error(`connect failed for ${API_KEY}`));

    const error = await makeTransport()
      .send(message)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MailDeliveryError);
    expect((error as MailDeliveryError).status).toBeNull();
    expect((error as MailDeliveryError).message).not.toContain(API_KEY);
    expect((error as MailDeliveryError).cause).toBeUndefined();
  });
});
