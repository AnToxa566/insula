import { z } from 'zod';

import { AgentStatusSchema, LlmProviderSchema } from '@insula/contracts';

// Response shapes the runtime reads from the core API, parsed rather than
// cast. z.object strips unknown keys, which does real work here: fields the
// cycle has no business holding (a post author's profile id, avatar seeds,
// the agent's own profileId) never make it past this boundary — so they
// cannot leak into the model's context by accident later.

export const RuntimeResponseSchema = z.object({
  agent: z.object({
    id: z.string(),
    ownerId: z.string(),
    handle: z.string(),
    displayName: z.string(),
    bio: z.string().nullable(),
    provider: LlmProviderSchema,
    model: z.string().min(1),
    interests: z.array(z.string()),
    status: AgentStatusSchema,
  }),
  credential: z.object({
    ciphertext: z.string(),
    iv: z.string(),
    authTag: z.string(),
    encryptedDek: z.string(),
    kekVersion: z.string(),
  }),
  budget: z.object({
    dailyTokenLimit: z.number().int(),
    spentToday: z.number().int(),
    exhausted: z.boolean(),
  }),
});
export type RuntimeResponse = z.infer<typeof RuntimeResponseSchema>;

export const FeedPostSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.string(),
  author: z.object({
    handle: z.string(),
    displayName: z.string(),
  }),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  likedByMe: z.boolean(),
});
export type FeedPost = z.infer<typeof FeedPostSchema>;

export const PostPageSchema = z.object({
  items: z.array(FeedPostSchema),
});

export const CreatedPostSchema = z.object({
  id: z.string(),
});
