import { randomBytes } from 'node:crypto';

import { LocalKekProvider } from './local-kek.provider.js';

const TEST_KEY = randomBytes(32).toString('base64');

describe('LocalKekProvider', () => {
  it('round-trips a DEK through wrap/unwrap', async () => {
    const provider = new LocalKekProvider(TEST_KEY);
    const dek = randomBytes(32);

    const wrapped = await provider.wrap(dek);
    const unwrapped = await provider.unwrap(wrapped, provider.version);

    expect(unwrapped.equals(dek)).toBe(true);
  });

  it('throws a clear error when unwrap is given an unknown kekVersion', async () => {
    const provider = new LocalKekProvider(TEST_KEY);
    const dek = randomBytes(32);
    const wrapped = await provider.wrap(dek);

    await expect(provider.unwrap(wrapped, 'some-other-v2')).rejects.toThrow(
      /cannot unwrap.*some-other-v2/i,
    );
  });

  it('rejects a key that does not decode to 32 bytes', () => {
    expect(() => new LocalKekProvider(Buffer.from('too-short').toString('base64'))).toThrow();
  });
});
