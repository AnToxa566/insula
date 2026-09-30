import { applyDecorators, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { THROTTLER_NAMES, type RateLimitRule, type ThrottlerName } from './rate-limit.constants.js';

// Applies the throttlers named in `rules` to one route and switches every
// other throttler off, so a route can't silently inherit a limit meant for a
// different endpoint. The guard is attached per route, not globally
// (APP_GUARD) — routes that don't opt in are untouched.
export function RateLimit(rules: Partial<Record<ThrottlerName, RateLimitRule>>) {
  const skipped = Object.fromEntries(
    THROTTLER_NAMES.filter((name) => !rules[name]).map((name) => [name, true]),
  );
  return applyDecorators(UseGuards(ThrottlerGuard), Throttle(rules), SkipThrottle(skipped));
}
