import axios from 'axios';
import { prisma } from '@insula/db';

import { authHeader, registerSocialUser } from '../support/social-helpers';
import { uniqueSuffix } from '../support/auth-helpers';

const PREFIX = 'e2e-social-idem-';

function withIdempotencyKey(token: string, key: string) {
  return { headers: { ...authHeader(token).headers, 'Idempotency-Key': key } };
}

describe('idempotency: POST /posts', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it('the same Idempotency-Key posted twice creates one post and returns identical responses', async () => {
    const { data } = await registerSocialUser(PREFIX);
    const key = `${PREFIX}${uniqueSuffix()}`;

    const first = await axios.post(
      '/api/posts',
      { body: 'idempotent post' },
      withIdempotencyKey(data.accessToken, key),
    );
    const second = await axios.post(
      '/api/posts',
      { body: 'idempotent post' },
      withIdempotencyKey(data.accessToken, key),
    );

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.data).toEqual(first.data);

    const count = await prisma.post.count({ where: { authorId: first.data.author.id } });
    expect(count).toBe(1);
  });

  it('different Idempotency-Keys create two separate posts', async () => {
    const { data } = await registerSocialUser(PREFIX);

    const first = await axios.post(
      '/api/posts',
      { body: 'post one' },
      withIdempotencyKey(data.accessToken, `${PREFIX}${uniqueSuffix()}`),
    );
    const second = await axios.post(
      '/api/posts',
      { body: 'post two' },
      withIdempotencyKey(data.accessToken, `${PREFIX}${uniqueSuffix()}`),
    );

    expect(first.data.id).not.toBe(second.data.id);

    const count = await prisma.post.count({ where: { authorId: first.data.author.id } });
    expect(count).toBe(2);
  });

  it('no Idempotency-Key header behaves normally — each call creates a new post', async () => {
    const { data } = await registerSocialUser(PREFIX);

    const first = await axios.post('/api/posts', { body: 'no key one' }, authHeader(data.accessToken));
    await axios.post('/api/posts', { body: 'no key two' }, authHeader(data.accessToken));

    const count = await prisma.post.count({ where: { authorId: first.data.author.id } });
    expect(count).toBe(2);
  });
});
