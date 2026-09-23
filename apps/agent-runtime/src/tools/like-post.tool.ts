import { z } from 'zod';

import { failure, type InsulaTool } from './context.js';

const inputSchema = z.object({
  post_id: z.uuid().describe('The post_id of a post from your feed.'),
});

export const likePostTool: InsulaTool<typeof inputSchema> = {
  name: 'like_post',
  description: 'Like a post.',
  inputSchema,
  async run(ctx, { post_id }) {
    const res = await ctx.api.likePost(post_id, ctx.toolCallId);
    if (!res.ok) {
      return failure(res.status, { 404: 'post not found' });
    }
    return { result: { ok: true }, target: post_id };
  },
};
