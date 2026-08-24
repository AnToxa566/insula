import type { CursorPage } from '@insula/contracts';

// Pure and DB-free on purpose: callers always fetch `take: limit + 1` rows
// (already ordered by the caller's query, see pagination.constants.ts) and
// hand the raw array straight in. This function only decides whether the
// extra row proves there's a next page, and if so drops it and reports the
// last *kept* row's id as the cursor for that next page.
export function paginate<T extends { id: string }>(
  rows: readonly T[],
  limit: number,
): CursorPage<T> {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows.slice();
  const nextCursor = hasNextPage ? items[items.length - 1].id : null;
  return { items, nextCursor };
}
