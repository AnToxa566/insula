import { ThrottlerGuard } from '@nestjs/throttler';

import { RATE_LIMITS, THROTTLER_NAMES, type ThrottlerName } from '../rate-limit/rate-limit.constants.js';
import { AuthController } from './auth.controller.js';
import { PasswordResetController } from './password-reset.controller.js';

// The metadata keys @nestjs/throttler writes (throttler.constants.ts, which the
// package doesn't export). Reading them back proves each handler carries the
// limits the policy table in rate-limit.constants.ts says it should — the
// per-IP limits are too high to exercise in e2e without tripping them.
const LIMIT = 'THROTTLER:LIMIT';
const TTL = 'THROTTLER:TTL';
const SKIP = 'THROTTLER:SKIP';

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type Handler = Function;

function expectThrottlers(handler: Handler, expected: Partial<Record<ThrottlerName, { limit: number; ttl: number }>>) {
  expect(Reflect.getMetadata('__guards__', handler)).toContain(ThrottlerGuard);
  for (const name of THROTTLER_NAMES) {
    const rule = expected[name];
    if (rule) {
      expect({
        limit: Reflect.getMetadata(LIMIT + name, handler),
        ttl: Reflect.getMetadata(TTL + name, handler),
      }).toEqual(rule);
      expect(Reflect.getMetadata(SKIP + name, handler)).not.toBe(true);
    } else {
      // Every throttler a route doesn't name is switched off, so it can't
      // inherit the module-level fallback.
      expect(Reflect.getMetadata(SKIP + name, handler)).toBe(true);
    }
  }
}

describe('rate limits on auth handlers', () => {
  const MINUTE = 60_000;

  it('POST /auth/password-reset/request: ip 20/15m, cooldown 1/60s, email 5/1h', () => {
    expectThrottlers(PasswordResetController.prototype.request, {
      ip: { limit: 20, ttl: 15 * MINUTE },
      cooldown: { limit: 1, ttl: MINUTE },
      email: { limit: 5, ttl: 60 * MINUTE },
    });
    expect(RATE_LIMITS.passwordResetRequest).toEqual({
      ip: { limit: 20, ttl: 15 * MINUTE },
      cooldown: { limit: 1, ttl: MINUTE },
      email: { limit: 5, ttl: 60 * MINUTE },
    });
  });

  it('POST /auth/password-reset/verify: ip 30/15m, email 10/15m', () => {
    expectThrottlers(PasswordResetController.prototype.verify, {
      ip: { limit: 30, ttl: 15 * MINUTE },
      email: { limit: 10, ttl: 15 * MINUTE },
    });
  });

  it('POST /auth/password-reset/confirm: ip 20/15m', () => {
    expectThrottlers(PasswordResetController.prototype.confirm, {
      ip: { limit: 20, ttl: 15 * MINUTE },
    });
  });

  it('POST /auth/change-password: user 5/15m', () => {
    expectThrottlers(AuthController.prototype.changePassword, {
      user: { limit: 5, ttl: 15 * MINUTE },
    });
  });
});
