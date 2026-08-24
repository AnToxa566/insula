import axios from 'axios';
import { prisma } from '@insula/db';

import { authHeader, registerSocialUser } from '../support/social-helpers';

const PREFIX = 'e2e-social-follow-';

async function postIdsIn(response: { data: { items: { id: string }[] } }): Promise<string[]> {
  return response.data.items.map((p) => p.id);
}

describe('social: follows and feed', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it('rejects following yourself with 400', async () => {
    const { identity, data } = await registerSocialUser(PREFIX);
    await expect(
      axios.put(`/api/profiles/${identity.handle}/follow`, null, authHeader(data.accessToken)),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('a followee’s posts move from /explore to /feed once followed, and back on unfollow', async () => {
    const follower = await registerSocialUser(PREFIX);
    const followee = await registerSocialUser(PREFIX);
    const post = await axios.post(
      '/api/posts',
      { body: 'followee content' },
      authHeader(followee.data.accessToken),
    );

    const feedBefore = await axios.get('/api/feed', authHeader(follower.data.accessToken));
    const exploreBefore = await axios.get('/api/explore', authHeader(follower.data.accessToken));
    expect(await postIdsIn(feedBefore)).not.toContain(post.data.id);
    expect(await postIdsIn(exploreBefore)).toContain(post.data.id);

    const followRes = await axios.put(
      `/api/profiles/${followee.identity.handle}/follow`,
      null,
      authHeader(follower.data.accessToken),
    );
    expect(followRes.status).toBe(204);

    const feedAfter = await axios.get('/api/feed', authHeader(follower.data.accessToken));
    const exploreAfter = await axios.get('/api/explore', authHeader(follower.data.accessToken));
    expect(await postIdsIn(feedAfter)).toContain(post.data.id);
    expect(await postIdsIn(exploreAfter)).not.toContain(post.data.id);

    // Unfollow is idempotent: both calls succeed, and the post reverts to /explore.
    const unfollow1 = await axios.delete(
      `/api/profiles/${followee.identity.handle}/follow`,
      authHeader(follower.data.accessToken),
    );
    expect(unfollow1.status).toBe(204);
    const unfollow2 = await axios.delete(
      `/api/profiles/${followee.identity.handle}/follow`,
      authHeader(follower.data.accessToken),
    );
    expect(unfollow2.status).toBe(204);

    const feedFinal = await axios.get('/api/feed', authHeader(follower.data.accessToken));
    expect(await postIdsIn(feedFinal)).not.toContain(post.data.id);
  });

  it('a caller’s own posts never appear in their own /explore', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const post = await axios.post('/api/posts', { body: 'my own post' }, authHeader(data.accessToken));

    const explore = await axios.get('/api/explore', authHeader(data.accessToken));
    expect(await postIdsIn(explore)).not.toContain(post.data.id);
  });

  it('lists followers and following correctly', async () => {
    const follower = await registerSocialUser(PREFIX);
    const followee = await registerSocialUser(PREFIX);

    await axios.put(
      `/api/profiles/${followee.identity.handle}/follow`,
      null,
      authHeader(follower.data.accessToken),
    );

    const followers = await axios.get(
      `/api/profiles/${followee.identity.handle}/followers`,
      authHeader(follower.data.accessToken),
    );
    expect(followers.data.items.map((p: { handle: string }) => p.handle)).toContain(
      follower.identity.handle,
    );

    const following = await axios.get(
      `/api/profiles/${follower.identity.handle}/following`,
      authHeader(follower.data.accessToken),
    );
    expect(following.data.items.map((p: { handle: string }) => p.handle)).toContain(
      followee.identity.handle,
    );
  });
});
