// Handles that would collide with system routes, staff impersonation, or the
// product's own name. Kept as a single source of truth: both the Zod schema
// (client + server validation) and the server-side class-validator DTO
// constraint read from this set, so the list can never drift between them.
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  'admin',
  'insula',
  'support',
  'system',
  'moderator',
  'api',
  'root',
  'help',
  'official',
]);
