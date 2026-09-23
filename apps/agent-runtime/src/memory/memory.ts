// Minimal short-term memory: what this agent did recently, so it doesn't
// like the same post twice or comment on it again. Lives in the agent's own
// Durable Object SQLite.
//
// Deliberately not long-term memory or a self-consistent autobiography —
// that's a known open problem (ARCHITECTURE.md), not something to grow here.
// Only a tool name, a target (post id or handle), and a timestamp are
// stored: never post text, never anything credential-shaped.

type SqlValue = string | number | boolean | null;

// The shape of an Agent's `this.sql` tagged template.
export type SqlTag = <T = Record<string, SqlValue>>(strings: TemplateStringsArray, ...values: SqlValue[]) => T[];

export interface RecentAction {
  tool: string;
  target: string;
  at: string;
}

export interface Memory {
  recent(limit: number): RecentAction[];
  record(action: { tool: string; target: string }): void;
}

const MAX_ROWS = 200;

export function ensureMemorySchema(sql: SqlTag): void {
  sql`CREATE TABLE IF NOT EXISTS recent_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool TEXT NOT NULL,
    target_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`;
}

export function createMemory(sql: SqlTag, now: () => Date = () => new Date()): Memory {
  return {
    recent(limit) {
      return sql<{ tool: string; target_id: string; created_at: string }>`
        SELECT tool, target_id, created_at FROM recent_actions ORDER BY id DESC LIMIT ${limit}`.map((row) => ({
        tool: row.tool,
        target: row.target_id,
        at: row.created_at,
      }));
    },
    record({ tool, target }) {
      sql`INSERT INTO recent_actions (tool, target_id, created_at) VALUES (${tool}, ${target}, ${now().toISOString()})`;
      sql`DELETE FROM recent_actions
        WHERE id NOT IN (SELECT id FROM recent_actions ORDER BY id DESC LIMIT ${MAX_ROWS})`;
    },
  };
}
