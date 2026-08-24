import { paginate } from './paginate.js';

interface Row {
  id: string;
  createdAt: string;
}

function rows(count: number, createdAt = '2026-01-01T00:00:00.000Z'): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${String(i).padStart(3, '0')}`,
    createdAt,
  }));
}

describe('paginate', () => {
  it('returns every row and a null cursor when there are fewer rows than the limit', () => {
    const result = paginate(rows(3), 10);
    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeNull();
  });

  it('returns every row and a null cursor when there are exactly `limit` rows (no extra row fetched)', () => {
    const result = paginate(rows(10), 10);
    expect(result.items).toHaveLength(10);
    expect(result.nextCursor).toBeNull();
  });

  it('drops the extra row and sets nextCursor to the last kept row id when limit + 1 rows come back', () => {
    const input = rows(11);
    const result = paginate(input, 10);
    expect(result.items).toHaveLength(10);
    expect(result.items).toEqual(input.slice(0, 10));
    expect(result.nextCursor).toBe(input[9].id);
    // the 11th row (the "is there a next page" probe) must never leak into items
    expect(result.items.some((item) => item.id === input[10].id)).toBe(false);
  });

  it('trusts the caller-supplied ordering rather than re-sorting, so the id tie-breaker is what keeps rows deterministic when createdAt collides', () => {
    // All rows share one createdAt — only the query's `orderBy: [{ createdAt }, { id }]`
    // (produced upstream, not by this function) keeps their relative order
    // stable across pages. paginate() just has to preserve whatever order it
    // was handed.
    const input = rows(11, '2026-01-01T00:00:00.000Z');
    const result = paginate(input, 10);
    expect(result.items.map((r) => r.id)).toEqual(input.slice(0, 10).map((r) => r.id));
    expect(result.nextCursor).toBe('id-009');
  });

  it('handles limit = 1', () => {
    const input = rows(2);
    const result = paginate(input, 1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(input[0].id);
    expect(result.nextCursor).toBe(input[0].id);
  });

  it('handles an empty input array', () => {
    const result = paginate([], 20);
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});
