import { LocalKekProvider } from '@insula/crypto';

import { CryptoService } from './crypto.service.js';

// Deep crypto behavior (round-trip, tamper detection, AAD binding, unknown
// kekVersion) is covered in @insula/crypto — see libs/crypto/src/lib. This
// spec only covers what's specific to this thin wrapper: that it wires the
// injected KekProvider through correctly and computes last4.
function makeService(): CryptoService {
  const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  return new CryptoService(new LocalKekProvider(key));
}

describe('CryptoService', () => {
  it('round-trips a credential through encrypt/decrypt', async () => {
    const service = makeService();
    const apiKey = 'sk-ant-super-secret-key-0001';

    const encrypted = await service.encrypt('user-1', 'agent-1', apiKey);
    const decrypted = await service.decrypt('user-1', 'agent-1', encrypted);

    expect(decrypted).toBe(apiKey);
  });

  it('records last4 as the last 4 characters of the plaintext key', async () => {
    const service = makeService();
    const encrypted = await service.encrypt('user-1', 'agent-1', 'sk-ant-abcd1234');

    expect(encrypted.last4).toBe('1234');
  });
});
