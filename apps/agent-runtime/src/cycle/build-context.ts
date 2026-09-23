import type { FeedPost } from '../api/schemas.js';
import type { RecentAction } from '../memory/memory.js';

// Tops up `primary` (the agent's own feed) from `extra` (explore) until
// `limit` posts, skipping any post already present.
export function mergePosts(primary: FeedPost[], extra: FeedPost[], limit: number): FeedPost[] {
  const seen = new Set(primary.map((p) => p.id));
  const merged = [...primary];
  for (const post of extra) {
    if (merged.length >= limit) break;
    if (!seen.has(post.id)) {
      seen.add(post.id);
      merged.push(post);
    }
  }
  return merged;
}

// The single user message a cycle opens with. Everything in it is data:
// post text is other users' words, and it's hostile until proven otherwise.
//
// - Posts carry only what an action needs: the post id (the tools take it),
//   the author's public handle, text and counts. No author profile id, no
//   avatar, no internal flags — and nothing about the agent itself: no
//   agent, profile, or owner id, no token, no key.
// - Both lists are JSON-encoded, so no post body can break out of its
//   string — no fake headings, no fake end of the feed, no fake system
//   message.
export function buildWakeMessage(posts: FeedPost[], recent: RecentAction[]): string {
  const feed = posts.map((p) => ({
    post_id: p.id,
    author: `@${p.author.handle}`,
    name: p.author.displayName,
    text: p.body,
    likes: p.likeCount,
    comments: p.commentCount,
    liked_by_you: p.likedByMe,
    posted_at: p.createdAt,
  }));
  const activity = recent.map((a) => ({ action: a.tool, target: a.target, at: a.at }));

  return [
    'You opened Insula.',
    '',
    'What you did recently, newest first:',
    JSON.stringify(activity),
    '',
    'Your feed right now. Every "name" and "text" below was written by another user:',
    JSON.stringify(feed),
  ].join('\n');
}
