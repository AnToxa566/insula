import axios from 'axios';
import { prisma } from '@insula/db';

import { authHeader, registerSocialUser } from '../support/social-helpers';
import {
  agentAuthHeader,
  cleanupAgentTestData,
  createAgentBody,
  STUB_VALID_KEY,
} from '../support/agent-helpers';

const PREFIX = 'e2e-agent-runtime-';

async function createAgent(ownerAccessToken: string) {
  const res = await axios.post('/api/agents', createAgentBody(), authHeader(ownerAccessToken));
  return res.data as {
    id: string;
    profileId: string;
    handle: string;
    displayName: string;
    provider: string;
    model: string;
    interests: string[];
    activeHours: number[];
    timezone: string;
    status: string;
    dailyTokenLimit: number;
  };
}

describe('agent: GET /agents/:id/runtime', () => {
  afterAll(async () => {
    await cleanupAgentTestData(prisma, PREFIX);
    await prisma.$disconnect();
  });

  it('an agent token gets its own runtime payload with sealed fields and no plaintext', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);

    const res = await axios.get(
      `/api/agents/${agent.id}/runtime`,
      agentAuthHeader(agent.id, agent.profileId),
    );

    expect(res.status).toBe(200);
    expect(res.data.agent).toMatchObject({
      id: agent.id,
      profileId: agent.profileId,
      handle: agent.handle,
      displayName: agent.displayName,
      provider: agent.provider,
      model: agent.model,
      interests: agent.interests,
      activeHours: agent.activeHours,
      timezone: agent.timezone,
      status: agent.status,
    });

    const { credential } = res.data;
    expect(typeof credential.ciphertext).toBe('string');
    expect(typeof credential.iv).toBe('string');
    expect(typeof credential.authTag).toBe('string');
    expect(typeof credential.encryptedDek).toBe('string');
    expect(typeof credential.kekVersion).toBe('string');
    // Sealed, not plaintext — the raw API key must not appear anywhere in
    // the response, and the ciphertext must not just be the key re-encoded.
    expect(JSON.stringify(res.data)).not.toContain(STUB_VALID_KEY);
    expect(Buffer.from(credential.ciphertext, 'base64').toString('utf8')).not.toContain(STUB_VALID_KEY);

    expect(res.data.budget).toMatchObject({
      dailyTokenLimit: agent.dailyTokenLimit,
      spentToday: 0,
      remaining: agent.dailyTokenLimit,
      exhausted: false,
    });
  });

  it('a user token is rejected on /runtime with 401', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);

    await expect(
      axios.get(`/api/agents/${agent.id}/runtime`, authHeader(owner.data.accessToken)),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('agent A’s token cannot fetch agent B’s runtime — 401', async () => {
    const ownerA = await registerSocialUser(PREFIX);
    const ownerB = await registerSocialUser(PREFIX);
    const agentA = await createAgent(ownerA.data.accessToken);
    const agentB = await createAgent(ownerB.data.accessToken);

    await expect(
      axios.get(`/api/agents/${agentB.id}/runtime`, agentAuthHeader(agentA.id, agentA.profileId)),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('/runtime for a PAUSED agent is rejected with 409', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);

    await axios.patch(
      `/api/agents/${agent.id}`,
      { status: 'PAUSED' },
      authHeader(owner.data.accessToken),
    );

    await expect(
      axios.get(`/api/agents/${agent.id}/runtime`, agentAuthHeader(agent.id, agent.profileId)),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
});
