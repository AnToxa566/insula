import { createHash } from 'node:crypto';

import { normalizeIp } from '@nestjs/throttler';

// Tracker functions for @nestjs/throttler: each turns a request into the
// string a counter is keyed on. They take a structural request type rather
// than Express's, since the throttler hands them `Record<string, any>`.
interface TrackedRequest {
  ip?: string;
  body?: unknown;
  user?: unknown;
}

// Fallback bucket when the address is unavailable. Shared on purpose — it
// fails closed (everyone without an address throttles together) rather than
// open.
const UNKNOWN_IP = 'ip:unknown';

export function ipTracker(req: TrackedRequest): string {
  if (typeof req.ip !== 'string' || req.ip.length === 0) return UNKNOWN_IP;
  // Same IPv6 subnet folding as the throttler's own default tracker, so one
  // host can't dodge the limit by rotating addresses within its /64.
  return `ip:${normalizeIp(req.ip)}`;
}

// Keys on sha256(email) so no address is held in the counter map. The email
// is normalised here (trim + lowercase) because throttler guards run before
// ValidationPipe — at this point the body is still exactly what the client
// sent, and "Alice@X.com" / "alice@x.com " must land in one bucket or the
// limit is trivially bypassed. A body without a string `email` falls back to
// the IP so malformed requests are still throttled.
//
// The key is computed without checking whether the account exists, so a 429
// reveals nothing about which emails are registered.
export function emailTracker(req: TrackedRequest): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  if (typeof email !== 'string') return ipTracker(req);
  const normalised = email.trim().toLowerCase();
  return `email:${createHash('sha256').update(normalised).digest('hex')}`;
}

// Keys on the JWT `sub` that JwtAuthGuard put on the request. The global
// JwtAuthGuard runs before route-level guards, so `user` is populated for any
// non-@Public route. Falls back to the IP if it somehow isn't.
export function userTracker(req: TrackedRequest): string {
  const sub = (req.user as { sub?: unknown } | undefined)?.sub;
  if (typeof sub !== 'string' || sub.length === 0) return ipTracker(req);
  return `user:${sub}`;
}
