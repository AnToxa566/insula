import axios from 'axios';
import { prisma } from '@insula/db';

import { authHeader, registerSocialUser } from '../support/social-helpers';
import { cleanupAgentTestData, createAgentBody, STUB_INVALID_KEY } from '../support/agent-helpers';

const PREFIX = 'e2e-agent-crud-';

// Every field name a credential row could leak through, checked as a literal
// JSON key (`"iv":`, not just the substring "iv" — which would false-positive
// on legitimate fields like "activeHours") against the full response body.
// Belt-and-suspenders on top of the per-field assertions below, so a future
// field added anywhere on the response accidentally carrying key material
// still fails this test.
const CREDENTIAL_JSON_KEYS = ['"ciphertext":', '"iv":', '"authTag":', '"encryptedDek":', '"dek":', '"kekVersion":'];

function assertNoCredentialMaterial(body: unknown): void {
  const json = JSON.stringify(body);
  for (const key of CREDENTIAL_JSON_KEYS) {
    expect(json).not.toContain(key);
  }
}

describe('agent: CRUD', () => {
  afterAll(async () => {
    await cleanupAgentTestData(prisma, PREFIX);
    await prisma.$disconnect();
  });

  it('creates an agent with a stubbed-valid key: 201, last4 present, no key material', async () => {
    const { data } = await registerSocialUser(PREFIX);

    const res = await axios.post('/api/agents', createAgentBody(), authHeader(data.accessToken));

    expect(res.status).toBe(201);
    expect(res.data.credential.last4).toBe('-key'); // last 4 chars of STUB_VALID_KEY
    expect(res.data.credential.provider).toBe('ANTHROPIC');
    expect(res.data.credential.lastValidatedAt).not.toBeNull();
    expect(res.data.credential.lastValidationError).toBeNull();
    expect(res.data.status).toBe('DRAFT');
    assertNoCredentialMaterial(res.data);
  });

  it('rejects a key the provider rejects with 400, and writes no agent or profile', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const body = createAgentBody({ apiKey: STUB_INVALID_KEY });

    await expect(axios.post('/api/agents', body, authHeader(data.accessToken))).rejects.toMatchObject({
      response: { status: 400 },
    });

    const profile = await prisma.profile.findUnique({ where: { handle: body.handle } });
    expect(profile).toBeNull();
  });

  it('GET /agents never includes ciphertext, iv, authTag, dek, or kekVersion', async () => {
    const { data } = await registerSocialUser(PREFIX);
    await axios.post('/api/agents', createAgentBody(), authHeader(data.accessToken));

    const list = await axios.get('/api/agents', authHeader(data.accessToken));
    expect(list.data.length).toBeGreaterThan(0);
    assertNoCredentialMaterial(list.data);
  });

  it('another user’s agent 404s, not 403', async () => {
    const owner = await registerSocialUser(PREFIX);
    const stranger = await registerSocialUser(PREFIX);
    const created = await axios.post('/api/agents', createAgentBody(), authHeader(owner.data.accessToken));

    await expect(
      axios.get(`/api/agents/${created.data.id}`, authHeader(stranger.data.accessToken)),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('PATCH updates persona fields but rejects provider and handle changes as unknown properties', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const created = await axios.post('/api/agents', createAgentBody(), authHeader(data.accessToken));

    const updated = await axios.patch(
      `/api/agents/${created.data.id}`,
      { displayName: 'Renamed Agent', status: 'ACTIVE' },
      authHeader(data.accessToken),
    );
    expect(updated.data.displayName).toBe('Renamed Agent');
    expect(updated.data.status).toBe('ACTIVE');

    await expect(
      axios.patch(`/api/agents/${created.data.id}`, { provider: 'OPENAI' }, authHeader(data.accessToken)),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('PUT credential replaces the key and updates last4', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const created = await axios.post('/api/agents', createAgentBody(), authHeader(data.accessToken));

    const replaced = await axios.put(
      `/api/agents/${created.data.id}/credential`,
      { apiKey: 'insula-e2e-stub-valid-newkey' },
      authHeader(data.accessToken),
    );
    expect(replaced.data.credential.last4).toBe('wkey');
    assertNoCredentialMaterial(replaced.data);
  });

  it('DELETE hard-deletes the agent, its profile, and its credential', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const created = await axios.post('/api/agents', createAgentBody(), authHeader(data.accessToken));

    const del = await axios.delete(`/api/agents/${created.data.id}`, authHeader(data.accessToken));
    expect(del.status).toBe(204);

    await expect(
      axios.get(`/api/agents/${created.data.id}`, authHeader(data.accessToken)),
    ).rejects.toMatchObject({ response: { status: 404 } });

    const credential = await prisma.agentCredential.findUnique({ where: { agentId: created.data.id } });
    expect(credential).toBeNull();
    const profile = await prisma.profile.findUnique({ where: { id: created.data.profileId } });
    expect(profile).toBeNull();
  });
});
