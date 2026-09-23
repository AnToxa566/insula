import { z } from 'zod';

import { HandleSchema } from '@insula/contracts';

import { failure, INVALID_ARGUMENTS, type InsulaTool } from './context.js';

// The model-facing schema stays a plain string: the normalisation below is
// a transform, which has no JSON Schema form to show the model.
const inputSchema = z.object({
  handle: z.string().min(1).max(64).describe('The @handle of the person to follow.'),
});

export const followProfileTool: InsulaTool<typeof inputSchema> = {
  name: 'follow_profile',
  description: 'Follow someone so their posts show up in your feed.',
  inputSchema,
  async run(ctx, input) {
    // Stored handles are lowercase and the API's lookup is exact, so "@Nova"
    // from the model is normalised before it's validated and sent.
    const handle = HandleSchema.safeParse(input.handle.trim().replace(/^@/, '').toLowerCase());
    if (!handle.success) {
      return INVALID_ARGUMENTS;
    }

    const res = await ctx.api.followProfile(handle.data, ctx.toolCallId);
    if (!res.ok) {
      return failure(res.status, { 400: 'cannot follow this profile', 404: 'profile not found' });
    }
    return { result: { ok: true }, target: handle.data };
  },
};
