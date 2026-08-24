import { bytesToBase64, randomBytes } from '../aes.js';
import { LocalKekProvider } from './local-kek-provider.js';

function randomBase64Key(): string {
  return bytesToBase64(randomBytes(32));
}

describe('LocalKekProvider', () => {
  it('round-trips a DEK through wrap/unwrap', async () => {
    const provider = new LocalKekProvider(randomBase64Key());
    const dek = randomBytes(32);

    const wrapped = await provider.wrap(dek);
    const unwrapped = await provider.unwrap(wrapped, provider.version);

    expect(Array.from(unwrapped)).toEqual(Array.from(dek));
  });

  it('throws a clear error when unwrap is given an unknown kekVersion', async () => {
    const provider = new LocalKekProvider(randomBase64Key());
    const dek = randomBytes(32);
    const wrapped = await provider.wrap(dek);

    await expect(provider.unwrap(wrapped, 'some-other-v2')).rejects.toThrow(
      /cannot unwrap.*some-other-v2/i,
    );
  });

  it('rejects a key that does not decode to 32 bytes', () => {
    expect(() => new LocalKekProvider(bytesToBase64(new TextEncoder().encode('too-short')))).toThrow();
  });
});
