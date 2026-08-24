import { randomBytes } from 'node:crypto';

import { CredentialEncryptionService } from './credential-encryption.service.js';
import { LocalKekProvider } from './kek/local-kek.provider.js';

const TEST_KEY = randomBytes(32).toString('base64');

function makeService(): CredentialEncryptionService {
  return new CredentialEncryptionService(new LocalKekProvider(TEST_KEY));
}

describe('CredentialEncryptionService', () => {
  it('round-trips: encrypting then decrypting returns the original key', async () => {
    const service = makeService();
    const apiKey = 'sk-ant-super-secret-key-0001';

    const encrypted = await service.encrypt('user-1', 'agent-1', apiKey);
    const decrypted = await service.decrypt('user-1', 'agent-1', encrypted);

    expect(decrypted).toBe(apiKey);
  });

  it('produces different ciphertext for the same plaintext encrypted twice', async () => {
    const service = makeService();
    const apiKey = 'sk-ant-super-secret-key-0001';

    const first = await service.encrypt('user-1', 'agent-1', apiKey);
    const second = await service.encrypt('user-1', 'agent-1', apiKey);

    // .equals() is a Buffer method, not part of the interface's declared
    // Uint8Array<ArrayBuffer> type (see toPrismaBytes() in the service) —
    // wrap with Buffer.from() to compare; the underlying bytes are still
    // ordinary Buffers at runtime either way.
    expect(Buffer.from(first.ciphertext).equals(Buffer.from(second.ciphertext))).toBe(false);
    expect(Buffer.from(first.iv).equals(Buffer.from(second.iv))).toBe(false);
  });

  it('throws when a single byte of ciphertext is tampered with', async () => {
    const service = makeService();
    const encrypted = await service.encrypt('user-1', 'agent-1', 'sk-ant-super-secret-key-0001');

    const tampered = Buffer.from(encrypted.ciphertext);
    tampered[0] ^= 0xff;

    await expect(
      service.decrypt('user-1', 'agent-1', { ...encrypted, ciphertext: tampered }),
    ).rejects.toThrow();
  });

  it('throws when decrypted with a different agent id as AAD', async () => {
    const service = makeService();
    const encrypted = await service.encrypt('user-1', 'agent-1', 'sk-ant-super-secret-key-0001');

    await expect(service.decrypt('user-1', 'agent-2', encrypted)).rejects.toThrow();
  });

  it('throws when decrypted with a different user id as AAD', async () => {
    const service = makeService();
    const encrypted = await service.encrypt('user-1', 'agent-1', 'sk-ant-super-secret-key-0001');

    await expect(service.decrypt('user-2', 'agent-1', encrypted)).rejects.toThrow();
  });

  it('records last4 as the last 4 characters of the plaintext key', async () => {
    const service = makeService();
    const encrypted = await service.encrypt('user-1', 'agent-1', 'sk-ant-abcd1234');

    expect(encrypted.last4).toBe('1234');
  });
});
