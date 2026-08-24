import { bytesToBase64, randomBytes } from './aes.js';
import { openCredential, sealCredential } from './envelope.js';
import { LocalKekProvider } from './kek/local-kek-provider.js';

function makeKek(): LocalKekProvider {
  return new LocalKekProvider(bytesToBase64(randomBytes(32)));
}

function aad(userId: string, agentId: string): string {
  return JSON.stringify({ userId, agentId });
}

describe('sealCredential / openCredential', () => {
  it('round-trips: sealing then opening returns the original plaintext', async () => {
    const kek = makeKek();
    const apiKey = 'sk-ant-super-secret-key-0001';

    const sealed = await sealCredential(apiKey, aad('user-1', 'agent-1'), kek);
    const opened = await openCredential(sealed, aad('user-1', 'agent-1'), kek);

    expect(opened).toBe(apiKey);
  });

  it('produces different ciphertext for the same plaintext sealed twice', async () => {
    const kek = makeKek();
    const apiKey = 'sk-ant-super-secret-key-0001';

    const first = await sealCredential(apiKey, aad('user-1', 'agent-1'), kek);
    const second = await sealCredential(apiKey, aad('user-1', 'agent-1'), kek);

    expect(Array.from(first.ciphertext)).not.toEqual(Array.from(second.ciphertext));
    expect(Array.from(first.iv)).not.toEqual(Array.from(second.iv));
  });

  it('throws when a single byte of ciphertext is tampered with', async () => {
    const kek = makeKek();
    const sealed = await sealCredential('sk-ant-super-secret-key-0001', aad('user-1', 'agent-1'), kek);

    const tampered = Uint8Array.from(sealed.ciphertext);
    tampered[0] ^= 0xff;

    await expect(
      openCredential({ ...sealed, ciphertext: tampered }, aad('user-1', 'agent-1'), kek),
    ).rejects.toThrow();
  });

  it('throws when opened with a different agent id bound into the AAD', async () => {
    const kek = makeKek();
    const sealed = await sealCredential('sk-ant-super-secret-key-0001', aad('user-1', 'agent-1'), kek);

    await expect(openCredential(sealed, aad('user-1', 'agent-2'), kek)).rejects.toThrow();
  });

  it('throws when opened with a different user id bound into the AAD', async () => {
    const kek = makeKek();
    const sealed = await sealCredential('sk-ant-super-secret-key-0001', aad('user-1', 'agent-1'), kek);

    await expect(openCredential(sealed, aad('user-2', 'agent-1'), kek)).rejects.toThrow();
  });

  it('throws a clear error for an unknown kekVersion', async () => {
    const kek = makeKek();
    const sealed = await sealCredential('sk-ant-super-secret-key-0001', aad('user-1', 'agent-1'), kek);

    await expect(
      openCredential({ ...sealed, kekVersion: 'some-other-v2' }, aad('user-1', 'agent-1'), kek),
    ).rejects.toThrow(/cannot unwrap.*some-other-v2/i);
  });
});
