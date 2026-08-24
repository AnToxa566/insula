import axios from 'axios';
import { prisma } from '@insula/db';

import { authHeader, registerSocialUser } from '../support/social-helpers';

const PREFIX = 'e2e-social-comments-';

describe('social: comments', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it('comments, replies once, but rejects a reply-to-a-reply with 400', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const post = await axios.post('/api/posts', { body: 'thread starter' }, authHeader(data.accessToken));

    const comment = await axios.post(
      `/api/posts/${post.data.id}/comments`,
      { body: 'root comment' },
      authHeader(data.accessToken),
    );
    expect(comment.status).toBe(201);
    expect(comment.data.parentId).toBeNull();

    const reply = await axios.post(
      `/api/posts/${post.data.id}/comments`,
      { body: 'a reply', parentId: comment.data.id },
      authHeader(data.accessToken),
    );
    expect(reply.status).toBe(201);
    expect(reply.data.parentId).toBe(comment.data.id);

    await expect(
      axios.post(
        `/api/posts/${post.data.id}/comments`,
        { body: 'reply to a reply', parentId: reply.data.id },
        authHeader(data.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('rejects a parentId that belongs to a different post with 400', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const postA = await axios.post('/api/posts', { body: 'post A' }, authHeader(data.accessToken));
    const postB = await axios.post('/api/posts', { body: 'post B' }, authHeader(data.accessToken));
    const commentOnA = await axios.post(
      `/api/posts/${postA.data.id}/comments`,
      { body: 'lives on A' },
      authHeader(data.accessToken),
    );

    await expect(
      axios.post(
        `/api/posts/${postB.data.id}/comments`,
        { body: 'cross-post reply', parentId: commentOnA.data.id },
        authHeader(data.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('lists root comments with their replies populated', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const post = await axios.post('/api/posts', { body: 'with replies' }, authHeader(data.accessToken));
    const root = await axios.post(
      `/api/posts/${post.data.id}/comments`,
      { body: 'root' },
      authHeader(data.accessToken),
    );
    const reply = await axios.post(
      `/api/posts/${post.data.id}/comments`,
      { body: 'reply', parentId: root.data.id },
      authHeader(data.accessToken),
    );

    const list = await axios.get(`/api/posts/${post.data.id}/comments`, authHeader(data.accessToken));
    const rootInList = list.data.items.find((c: { id: string }) => c.id === root.data.id);
    expect(rootInList).toBeDefined();
    expect(rootInList.replies.map((r: { id: string }) => r.id)).toContain(reply.data.id);
  });

  it('deletes own comment with 204, rejects deleting someone else’s with 404', async () => {
    const owner = await registerSocialUser(PREFIX);
    const stranger = await registerSocialUser(PREFIX);
    const post = await axios.post('/api/posts', { body: 'comment ownership' }, authHeader(owner.data.accessToken));
    const comment = await axios.post(
      `/api/posts/${post.data.id}/comments`,
      { body: 'mine' },
      authHeader(owner.data.accessToken),
    );

    await expect(
      axios.delete(`/api/comments/${comment.data.id}`, authHeader(stranger.data.accessToken)),
    ).rejects.toMatchObject({ response: { status: 404 } });

    const del = await axios.delete(`/api/comments/${comment.data.id}`, authHeader(owner.data.accessToken));
    expect(del.status).toBe(204);
  });
});
