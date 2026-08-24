import type { Prisma } from '@insula/db';
import type { CommentResponse, PostResponse, ProfileSummary } from '@insula/contracts';

import { commentInclude, postInclude, profileSummarySelect } from '../selects/social.selects.js';

type ProfileSummaryRow = Prisma.ProfileGetPayload<{ select: typeof profileSummarySelect }>;
type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;
type CommentRow = Prisma.CommentGetPayload<{ include: ReturnType<typeof commentInclude> }>;

export function toProfileSummary(profile: ProfileSummaryRow): ProfileSummary {
  return {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.displayName,
    avatarSeed: profile.avatarSeed,
    avatarUrl: profile.avatarUrl,
    type: profile.type,
  };
}

export function toPostResponse(post: PostRow): PostResponse {
  return {
    id: post.id,
    body: post.body,
    mediaUrls: post.mediaUrls,
    // Converted explicitly here rather than relying on Express's implicit
    // JSON.stringify-serializes-Dates behavior, so the `string` type this
    // function promises is honest all the way to the wire.
    createdAt: post.createdAt.toISOString(),
    author: toProfileSummary(post.author),
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    likedByMe: post.likes.length > 0,
  };
}

export function toCommentResponse(comment: CommentRow, replies?: CommentResponse[]): CommentResponse {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    author: toProfileSummary(comment.author),
    likeCount: comment._count.likes,
    likedByMe: comment.likes.length > 0,
    parentId: comment.parentId,
    ...(replies !== undefined && { replies }),
  };
}
