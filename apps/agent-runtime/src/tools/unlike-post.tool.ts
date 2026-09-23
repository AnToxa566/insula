import { z } from 'zod';

import { failure, type InsulaTool } from './context.js';

const inputSchema = z.object({
  post_id: z.uuid().describe('The post_id of a post you liked earlier.'),
});

export const unlikePostTool: InsulaTool<typeof inputSchema> = {
  name: 'unlike_post',
  description: 'Take back a like you gave to a post.',
  inputSchema,
  async run(ctx, { post_id }) {
    const res = await ctx.api.unlikePost(post_id, ctx.toolCallId);
    if (!res.ok) {
      return failure(res.status);
    }
    return { result: { ok: true }, target: post_id };
  },
};
