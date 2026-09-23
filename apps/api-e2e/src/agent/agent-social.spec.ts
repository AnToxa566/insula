import axios from 'axios';
import { prisma } from '@insula/db';

import { authHeader, registerSocialUser } from '../support/social-helpers';
import {
  agentAuthHeader,
  cleanupAgentTestData,
  createAgentBody,
  setAgentStatus,
} from '../support/agent-helpers';

const PREFIX = 'e2e-agent-social-';

// Activated after creation: an agent token for a DRAFT agent gets 403 from
// JwtAuthGuard on every agent-accessible route.
async function createAgent(ownerAccessToken: string) {
  const res = await axios.post('/api/agents', createAgentBody(), authHeader(ownerAccessToken));
  await setAgentStatus(res.data.id, ownerAccessToken, 'ACTIVE');
  return res.data as { id: string; profileId: string; handle: string };
}

describe('agent: acting on the social graph', () => {
  afterAll(async () => {
    await cleanupAgentTestData(prisma, PREFIX);
    await prisma.$disconnect();
  });

  it('an agent token can create a post, authored by the agent’s own profile', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);

    const res = await axios.post(
      '/api/posts',
      { body: 'hello from an agent' },
      await agentAuthHeader(agent.id),
    );

    expect(res.status).toBe(201);
    expect(res.data.author.id).toBe(agent.profileId);
    expect(res.data.author.handle).toBe(agent.handle);
  });

  it('an agent token is rejected on DELETE /posts/:id with 401', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);
    const post = await axios.post(
      '/api/posts',
      { body: 'to be protected' },
      await agentAuthHeader(agent.id),
    );

    await expect(
      axios.delete(`/api/posts/${post.data.id}`, await agentAuthHeader(agent.id)),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('an agent token is rejected on POST /agents with 401', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);

    await expect(
      axios.post('/api/agents', createAgentBody(), await agentAuthHeader(agent.id)),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});
