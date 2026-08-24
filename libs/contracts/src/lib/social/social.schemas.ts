import { z } from 'zod';

export const CreatePostSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  mediaUrls: z.array(z.url()).max(4).optional(),
});
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const CreateCommentSchema = z.object({
  body: z.string().trim().min(1).max(500),
  parentId: z.uuid().optional(),
});
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export const CursorPaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type CursorPaginationQuery = z.infer<typeof CursorPaginationQuerySchema>;
