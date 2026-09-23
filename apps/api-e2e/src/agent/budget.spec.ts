import axios from 'axios';
import { prisma } from '@insula/db';

import { authHeader, registerSocialUser } from '../support/social-helpers';
import {
  agentAuthHeader,
  cleanupAgentTestData,
  createAgentBody,
  setAgentStatus,
} from '../support/agent-helpers';

const PREFIX = 'e2e-agent-budget-';

// Activated after creation: an agent token for a DRAFT agent gets 403 from
// JwtAuthGuard, including on /usage and /budget.
async function createAgent(ownerAccessToken: string, overrides: Record<string, unknown> = {}) {
  const res = await axios.post('/api/agents', createAgentBody(overrides), authHeader(ownerAccessToken));
  await setAgentStatus(res.data.id, ownerAccessToken, 'ACTIVE');
  return res.data as { id: string; profileId: string; dailyTokenLimit: number };
}

describe('agent: token budget', () => {
  afterAll(async () => {
    await cleanupAgentTestData(prisma, PREFIX);
    await prisma.$disconnect();
  });

  it('two concurrent usage reports both land — no lost update', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);
    const auth = await agentAuthHeader(agent.id);

    await Promise.all([
      axios.post(`/api/agents/${agent.id}/usage`, { inputTokens: 100, outputTokens: 50 }, auth),
      axios.post(`/api/agents/${agent.id}/usage`, { inputTokens: 100, outputTokens: 50 }, auth),
    ]);

    const budget = await axios.get(`/api/agents/${agent.id}/budget`, auth);
    expect(budget.data.spentToday).toBe(300); // (100+50) * 2
  });

  it('usage at the limit makes budget.exhausted true', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken, { dailyTokenLimit: 100 });
    const auth = await agentAuthHeader(agent.id);

    const before = await axios.get(`/api/agents/${agent.id}/budget`, auth);
    expect(before.data.exhausted).toBe(false);

    await axios.post(`/api/agents/${agent.id}/usage`, { inputTokens: 60, outputTokens: 40 }, auth);

    const after = await axios.get(`/api/agents/${agent.id}/budget`, auth);
    expect(after.data.spentToday).toBe(100);
    expect(after.data.remaining).toBe(0);
    expect(after.data.exhausted).toBe(true);
  });

  it('the owner can also read the budget', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);

    const res = await axios.get(`/api/agents/${agent.id}/budget`, authHeader(owner.data.accessToken));
    expect(res.status).toBe(200);
    expect(res.data.dailyTokenLimit).toBe(agent.dailyTokenLimit);
  });

  it('agent A’s token cannot read agent B’s budget', async () => {
    const ownerA = await registerSocialUser(PREFIX);
    const ownerB = await registerSocialUser(PREFIX);
    const agentA = await createAgent(ownerA.data.accessToken);
    const agentB = await createAgent(ownerB.data.accessToken);

    await expect(
      axios.get(`/api/agents/${agentB.id}/budget`, await agentAuthHeader(agentA.id)),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('agent-only: a user token is rejected on POST /agents/:id/usage', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);

    await expect(
      axios.post(
        `/api/agents/${agent.id}/usage`,
        { inputTokens: 1, outputTokens: 1 },
        authHeader(owner.data.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 403 } });
  });
});
