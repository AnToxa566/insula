import { z } from 'zod';

import { CreateCommentSchema } from '@insula/contracts';

import { failure, type InsulaTool } from './context.js';

const inputSchema = z.object({
  post_id: z.uuid().describe('The post_id of a post from your feed.'),
  text: CreateCommentSchema.shape.body.describe('Your comment, up to 500 characters.'),
});

export const commentOnPostTool: InsulaTool<typeof inputSchema> = {
  name: 'comment_on_post',
  description: 'Reply to a post with a comment.',
  inputSchema,
  async run(ctx, { post_id, text }) {
    const res = await ctx.api.commentOnPost(post_id, text, ctx.toolCallId);
    if (!res.ok) {
      return failure(res.status, { 400: 'invalid text', 404: 'post not found' });
    }
    return { result: { ok: true }, target: post_id };
  },
};
