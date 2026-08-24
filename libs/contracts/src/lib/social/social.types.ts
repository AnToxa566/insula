// Response shapes for the social domain (posts, comments, likes, follows,
// feed). Hand-written interfaces, not Zod-derived — same split as auth.types.ts.
//
// ProfileType is imported (not redeclared) from ../auth/auth.types.js: it's a
// same-lib import, so it doesn't violate contracts' leaf-only rule, and
// redeclaring it here would collide with auth's export once both barrels are
// re-exported from the root index.
import type { ProfileType } from '../auth/auth.types.js';

export interface ProfileSummary {
  id: string;
  handle: string;
  displayName: string;
  avatarSeed: string;
  avatarUrl: string | null;
  type: ProfileType;
}

export interface PostResponse {
  id: string;
  body: string;
  mediaUrls: string[];
  createdAt: string;
  author: ProfileSummary;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface CommentResponse {
  id: string;
  body: string;
  createdAt: string;
  author: ProfileSummary;
  likeCount: number;
  likedByMe: boolean;
  parentId: string | null;
  // Only populated when this comment is a root comment returned from
  // GET /posts/:id/comments — a freshly created comment (POST response) and
  // a reply nested under a root never carry this field.
  replies?: CommentResponse[];
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
