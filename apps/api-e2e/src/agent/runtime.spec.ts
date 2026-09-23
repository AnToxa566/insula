import { randomUUID } from 'node:crypto';

import axios from 'axios';
import { prisma } from '@insula/db';

import { authHeader, registerSocialUser } from '../support/social-helpers';
import {
  agentAuthHeader,
  cleanupAgentTestData,
  createAgentBody,
  setAgentStatus,
  STUB_VALID_KEY,
} from '../support/agent-helpers';

const PREFIX = 'e2e-agent-runtime-';

// Created and then activated — an agent token for a DRAFT agent gets 403
// from JwtAuthGuard on every agent-accessible route.
async function createAgent(ownerAccessToken: string) {
  const res = await axios.post('/api/agents', createAgentBody(), authHeader(ownerAccessToken));
  await setAgentStatus(res.data.id, ownerAccessToken, 'ACTIVE');
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
    dailyTokenLimit: number;
  };
}

afterAll(async () => {
  await cleanupAgentTestData(prisma, PREFIX);
  await prisma.$disconnect();
});

describe('agent: GET /agents/:id/runtime', () => {
  it('an agent token gets its own runtime payload with sealed fields and no plaintext', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);

    const res = await axios.get(`/api/agents/${agent.id}/runtime`, await agentAuthHeader(agent.id));

    expect(res.status).toBe(200);
    expect(res.data.agent).toMatchObject({
      id: agent.id,
      profileId: agent.profileId,
      // The runner rebuilds the credential AAD from this — see
      // AgentRuntimeInfo.ownerId in @insula/contracts.
      ownerId: owner.data.user.id,
      handle: agent.handle,
      displayName: agent.displayName,
      provider: agent.provider,
      model: agent.model,
      interests: agent.interests,
      activeHours: agent.activeHours,
      timezone: agent.timezone,
      status: 'ACTIVE',
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
      axios.get(`/api/agents/${agentB.id}/runtime`, await agentAuthHeader(agentA.id)),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  // Identity not established: the signature is valid, but no such agent.
  it('a validly signed token for an agent that does not exist is rejected with 401', async () => {
    const ghost = randomUUID();

    await expect(
      axios.get(`/api/agents/${ghost}/runtime`, await agentAuthHeader(ghost)),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

// Status is enforced once, in JwtAuthGuard, for every agent-accessible route
// — not per controller. Each case below hits both /runtime and a social
// write to prove the check is global.
describe('agent: status enforcement in JwtAuthGuard', () => {
  it('a PAUSED agent’s token gets 403 on GET /runtime and on POST /posts', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);
    await setAgentStatus(agent.id, owner.data.accessToken, 'PAUSED');
    const auth = await agentAuthHeader(agent.id);

    await expect(axios.get(`/api/agents/${agent.id}/runtime`, auth)).rejects.toMatchObject({
      response: { status: 403 },
    });
    await expect(axios.post('/api/posts', { body: 'should never land' }, auth)).rejects.toMatchObject({
      response: { status: 403 },
    });
  });

  it('a DRAFT agent’s token gets 403 on GET /runtime and on POST /posts', async () => {
    const owner = await registerSocialUser(PREFIX);
    const created = await axios.post('/api/agents', createAgentBody(), authHeader(owner.data.accessToken));
    expect(created.data.status).toBe('DRAFT');
    const auth = await agentAuthHeader(created.data.id);

    await expect(axios.get(`/api/agents/${created.data.id}/runtime`, auth)).rejects.toMatchObject({
      response: { status: 403 },
    });
    await expect(axios.post('/api/posts', { body: 'should never land' }, auth)).rejects.toMatchObject({
      response: { status: 403 },
    });
  });

  it('re-activating a paused agent restores access', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);
    await setAgentStatus(agent.id, owner.data.accessToken, 'PAUSED');
    await setAgentStatus(agent.id, owner.data.accessToken, 'ACTIVE');

    const res = await axios.get(`/api/agents/${agent.id}/runtime`, await agentAuthHeader(agent.id));
    expect(res.status).toBe(200);
  });
});
