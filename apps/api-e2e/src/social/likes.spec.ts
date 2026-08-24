import axios from 'axios';
import { prisma } from '@insula/db';

import { authHeader, registerSocialUser } from '../support/social-helpers';

const PREFIX = 'e2e-social-likes-';

describe('social: likes', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it('liking a post twice still counts as one like', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const post = await axios.post('/api/posts', { body: 'like me' }, authHeader(data.accessToken));

    const first = await axios.put(`/api/posts/${post.data.id}/like`, null, authHeader(data.accessToken));
    expect(first.status).toBe(204);
    const second = await axios.put(`/api/posts/${post.data.id}/like`, null, authHeader(data.accessToken));
    expect(second.status).toBe(204);

    const fetched = await axios.get(`/api/posts/${post.data.id}`, authHeader(data.accessToken));
    expect(fetched.data.likeCount).toBe(1);
    expect(fetched.data.likedByMe).toBe(true);
  });

  it('unliking a post that was never liked is a no-op 204', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const post = await axios.post('/api/posts', { body: 'never liked' }, authHeader(data.accessToken));

    const res = await axios.delete(`/api/posts/${post.data.id}/like`, authHeader(data.accessToken));
    expect(res.status).toBe(204);
  });

  it('liking a comment twice still counts as one like', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const post = await axios.post('/api/posts', { body: 'comment host' }, authHeader(data.accessToken));
    const comment = await axios.post(
      `/api/posts/${post.data.id}/comments`,
      { body: 'like this comment' },
      authHeader(data.accessToken),
    );

    await axios.put(`/api/comments/${comment.data.id}/like`, null, authHeader(data.accessToken));
    const second = await axios.put(`/api/comments/${comment.data.id}/like`, null, authHeader(data.accessToken));
    expect(second.status).toBe(204);

    const list = await axios.get(`/api/posts/${post.data.id}/comments`, authHeader(data.accessToken));
    const found = list.data.items.find((c: { id: string }) => c.id === comment.data.id);
    expect(found.likeCount).toBe(1);
    expect(found.likedByMe).toBe(true);
  });

  it('unliking a comment that was never liked is a no-op 204', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const post = await axios.post('/api/posts', { body: 'comment host 2' }, authHeader(data.accessToken));
    const comment = await axios.post(
      `/api/posts/${post.data.id}/comments`,
      { body: 'never liked comment' },
      authHeader(data.accessToken),
    );

    const res = await axios.delete(`/api/comments/${comment.data.id}/like`, authHeader(data.accessToken));
    expect(res.status).toBe(204);
  });
});
