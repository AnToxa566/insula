import axios from 'axios';
import { prisma } from '@insula/db';

import { authHeader, registerSocialUser } from '../support/social-helpers';

const PREFIX = 'e2e-social-posts-';

describe('social: posts', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it('creates a post and it appears in the author’s own posts', async () => {
    const { identity, data } = await registerSocialUser(PREFIX);
    const created = await axios.post(
      '/api/posts',
      { body: 'hello insula' },
      authHeader(data.accessToken),
    );
    expect(created.status).toBe(201);
    expect(created.data.body).toBe('hello insula');
    expect(created.data.author.handle).toBe(identity.handle);
    expect(created.data.likeCount).toBe(0);
    expect(created.data.commentCount).toBe(0);
    expect(created.data.likedByMe).toBe(false);

    const own = await axios.get(`/api/profiles/${identity.handle}/posts`, authHeader(data.accessToken));
    expect(own.data.items.map((p: { id: string }) => p.id)).toContain(created.data.id);
  });

  it('deletes own post with 204, then the post 404s', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const created = await axios.post('/api/posts', { body: 'to be deleted' }, authHeader(data.accessToken));

    const del = await axios.delete(`/api/posts/${created.data.id}`, authHeader(data.accessToken));
    expect(del.status).toBe(204);

    await expect(
      axios.get(`/api/posts/${created.data.id}`, authHeader(data.accessToken)),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects deleting someone else’s post with 404', async () => {
    const owner = await registerSocialUser(PREFIX);
    const stranger = await registerSocialUser(PREFIX);
    const created = await axios.post(
      '/api/posts',
      { body: 'not yours' },
      authHeader(owner.data.accessToken),
    );

    await expect(
      axios.delete(`/api/posts/${created.data.id}`, authHeader(stranger.data.accessToken)),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('paginates 25 posts with limit=10 across 3 pages with no duplicates and no gaps', async () => {
    const { identity, data } = await registerSocialUser(PREFIX);
    const createdIds: string[] = [];
    for (let i = 0; i < 25; i++) {
      const res = await axios.post(
        '/api/posts',
        { body: `paginated post ${i}` },
        authHeader(data.accessToken),
      );
      createdIds.push(res.data.id);
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    const pageSizes: number[] = [];
    for (let page = 0; page < 3; page++) {
      const res = await axios.get(`/api/profiles/${identity.handle}/posts`, {
        ...authHeader(data.accessToken),
        params: { limit: 10, ...(cursor && { cursor }) },
      });
      pageSizes.push(res.data.items.length);
      seen.push(...res.data.items.map((p: { id: string }) => p.id));
      cursor = res.data.nextCursor ?? undefined;
    }

    expect(pageSizes).toEqual([10, 10, 5]);
    expect(cursor).toBeUndefined();
    expect(new Set(seen).size).toBe(25);
    expect(seen.sort()).toEqual(createdIds.sort());
  });
});
