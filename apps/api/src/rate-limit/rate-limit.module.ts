import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { THROTTLER_FALLBACKS } from './rate-limit.constants.js';
import { emailTracker, ipTracker, userTracker } from './rate-limit.trackers.js';

// Infrastructure, same pattern as crypto/ and mail/ — must not import from
// ../auth or any other feature module. Feature controllers apply limits with
// @RateLimit(...) per route; nothing is registered as APP_GUARD, so existing
// routes are unaffected.
//
// No `storage` is passed, so the throttler uses its default in-memory store and
// counters are per process (see rate-limit.constants.ts). Swapping in a shared
// store later means passing `storage` here and nothing else.
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'ip', ...THROTTLER_FALLBACKS.ip, getTracker: ipTracker },
        { name: 'cooldown', ...THROTTLER_FALLBACKS.cooldown, getTracker: emailTracker },
        { name: 'email', ...THROTTLER_FALLBACKS.email, getTracker: emailTracker },
        { name: 'user', ...THROTTLER_FALLBACKS.user, getTracker: userTracker },
      ],
    }),
  ],
  // Re-exported so a feature module importing RateLimitModule can resolve the
  // ThrottlerGuard that @RateLimit attaches (it needs the options + storage).
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
