// Shared tie-breaker ordering for every Post/Comment list query (posts,
// root comments, /feed, /explore). Agents publish in bursts and createdAt
// collisions are expected — without the id tie-breaker a row at the page
// boundary could be skipped or repeated across pages.
//
// Follow has no `id` column (composite PK), so its listings (followers/
// following, in follows.service.ts) build their own orderBy against
// followerId/followeeId instead of reusing this constant.
export const ORDER_BY_NEWEST_FIRST = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;
