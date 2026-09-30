import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://insula:insula@localhost:5432/insula',
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
  AGENT_SERVICE_SECRET: 'agent-secret',
  CREDENTIAL_ENCRYPTION_KEY: 'key',
};

describe('validateEnv', () => {
  it('defaults to the console mail transport and no trusted proxies', () => {
    const env = validateEnv(base);
    expect(env.MAIL_TRANSPORT).toBe('console');
    expect(env.MAIL_FROM_NAME).toBe('Insula');
    expect(env.TRUST_PROXY_HOPS).toBe(0);
  });

  it('accepts the console transport without a Brevo key or sender', () => {
    expect(() => validateEnv({ ...base, MAIL_TRANSPORT: 'console' })).not.toThrow();
  });

  it('rejects the brevo transport without an API key', () => {
    expect(() =>
      validateEnv({ ...base, MAIL_TRANSPORT: 'brevo', MAIL_FROM_EMAIL: 'no-reply@insula.app' }),
    ).toThrow(/BREVO_API_KEY: Required when MAIL_TRANSPORT=brevo/);
  });

  it('rejects the brevo transport without a sender address', () => {
    expect(() =>
      validateEnv({ ...base, MAIL_TRANSPORT: 'brevo', BREVO_API_KEY: 'xkeysib-test' }),
    ).toThrow(/MAIL_FROM_EMAIL: Required when MAIL_TRANSPORT=brevo/);
  });

  it('accepts the brevo transport with a key and a sender', () => {
    const env = validateEnv({
      ...base,
      MAIL_TRANSPORT: 'brevo',
      BREVO_API_KEY: 'xkeysib-test',
      MAIL_FROM_EMAIL: 'no-reply@insula.app',
    });
    expect(env.MAIL_TRANSPORT).toBe('brevo');
  });

  it('rejects an unknown mail transport', () => {
    expect(() => validateEnv({ ...base, MAIL_TRANSPORT: 'smtp' })).toThrow(/MAIL_TRANSPORT/);
  });

  it('rejects a malformed sender address', () => {
    expect(() => validateEnv({ ...base, MAIL_FROM_EMAIL: 'not-an-email' })).toThrow(
      /MAIL_FROM_EMAIL/,
    );
  });

  it('does not echo secret values in validation errors', () => {
    let message = '';
    try {
      validateEnv({ ...base, MAIL_TRANSPORT: 'brevo', BREVO_API_KEY: 'xkeysib-secret-value' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain('xkeysib-secret-value');
  });

  describe('TRUST_PROXY_HOPS', () => {
    it('coerces a numeric string to an integer', () => {
      expect(validateEnv({ ...base, TRUST_PROXY_HOPS: '1' }).TRUST_PROXY_HOPS).toBe(1);
    });

    it('rejects a negative value', () => {
      expect(() => validateEnv({ ...base, TRUST_PROXY_HOPS: '-1' })).toThrow(/TRUST_PROXY_HOPS/);
    });

    it('rejects a non-integer value', () => {
      expect(() => validateEnv({ ...base, TRUST_PROXY_HOPS: '1.5' })).toThrow(/TRUST_PROXY_HOPS/);
    });

    it('rejects a non-numeric value', () => {
      expect(() => validateEnv({ ...base, TRUST_PROXY_HOPS: 'many' })).toThrow(/TRUST_PROXY_HOPS/);
    });
  });
});
