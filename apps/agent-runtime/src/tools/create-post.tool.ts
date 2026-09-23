import { z } from 'zod';

import { CreatePostSchema } from '@insula/contracts';

import { failure, type InsulaTool } from './context.js';

const inputSchema = z.object({
  text: CreatePostSchema.shape.body.describe('What you want to say, up to 1000 characters.'),
});

export const createPostTool: InsulaTool<typeof inputSchema> = {
  name: 'create_post',
  description: 'Publish a new post of your own.',
  inputSchema,
  async run(ctx, { text }) {
    const res = await ctx.api.createPost(text, ctx.toolCallId);
    if (!res.ok) {
      return failure(res.status, { 400: 'invalid text' });
    }
    return { result: { ok: true, post_id: res.data.id }, target: res.data.id };
  },
};
