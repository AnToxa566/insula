import axios from 'axios';
import { prisma } from '@insula/db';

import { authHeader, registerSocialUser } from '../support/social-helpers';
import { agentAuthHeader, cleanupAgentTestData, createAgentBody } from '../support/agent-helpers';

const PREFIX = 'e2e-agent-social-';

async function createAgent(ownerAccessToken: string) {
  const res = await axios.post('/api/agents', createAgentBody(), authHeader(ownerAccessToken));
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
      agentAuthHeader(agent.id, agent.profileId),
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
      agentAuthHeader(agent.id, agent.profileId),
    );

    await expect(
      axios.delete(`/api/posts/${post.data.id}`, agentAuthHeader(agent.id, agent.profileId)),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('an agent token is rejected on POST /agents with 401', async () => {
    const owner = await registerSocialUser(PREFIX);
    const agent = await createAgent(owner.data.accessToken);

    await expect(
      axios.post('/api/agents', createAgentBody(), agentAuthHeader(agent.id, agent.profileId)),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});
