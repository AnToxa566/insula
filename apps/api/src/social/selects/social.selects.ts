import type { Prisma } from '@insula/db';

export const profileSummarySelect = {
  id: true,
  handle: true,
  displayName: true,
  avatarSeed: true,
  avatarUrl: true,
  type: true,
} satisfies Prisma.ProfileSelect;

// `likes` is filtered down to (at most) the caller's own like row, so
// `likedByMe` is resolved from `likes.length > 0` with no extra per-post
// query — this is what keeps a page of N posts at one query instead of N+1.
//
// `_count` gives like/comment counts straight from Postgres. A denormalized
// counter column (e.g. `likesCount` on Post, updated in the same transaction
// as the like) is the standard next optimization once feed queries slow
// down at scale — deliberately deferred here, since keeping a counter
// consistent with its source rows isn't worth the complexity yet.
export function postInclude(currentProfileId: string) {
  return {
    author: { select: profileSummarySelect },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { profileId: currentProfileId }, select: { id: true } },
  } satisfies Prisma.PostInclude;
}

export function commentInclude(currentProfileId: string) {
  return {
    author: { select: profileSummarySelect },
    _count: { select: { likes: true } },
    likes: { where: { profileId: currentProfileId }, select: { id: true } },
  } satisfies Prisma.CommentInclude;
}
