import type { ThrottlerOptions } from '@nestjs/throttler';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// Throttler names. A route picks which of these apply via @RateLimit; the
// tracker behind each name is wired in rate-limit.module.ts.
//   ip       — client address (needs TRUST_PROXY_HOPS behind a proxy)
//   cooldown — per-email resend cooldown
//   email    — per-email rolling cap
//   user     — authenticated user id (the JWT `sub`)
export const THROTTLER_NAMES = ['ip', 'cooldown', 'email', 'user'] as const;
export type ThrottlerName = (typeof THROTTLER_NAMES)[number];

export interface RateLimitRule {
  limit: number;
  // Milliseconds — @nestjs/throttler v6.
  ttl: number;
}

// The password-flow policy in one place. Counters are in-memory and therefore
// per process: with N Cloud Run instances the effective limit is up to N times
// these numbers, and they reset on restart or scale-from-zero. Only two limits
// hold across instances because they live in Postgres: 5 attempts per code and
// one code per 60s per user. Neither bounds guessing over a longer horizon —
// an attacker can keep making 5 guesses a minute on one account (~7,200/day,
// roughly a 0.7% chance per day against a 6-digit code). The per-email cap of
// 5 codes/hour below is the only thing that bounds brute-forcing over time, and
// it is per instance. Do not treat these in-memory limits as the security
// boundary; a cross-instance per-account issuance cap is a pre-launch item
// (see SECURITY.md).
export const RATE_LIMITS = {
  passwordResetRequest: {
    ip: { limit: 20, ttl: 15 * MINUTE },
    cooldown: { limit: 1, ttl: MINUTE },
    email: { limit: 5, ttl: HOUR },
  },
  passwordResetVerify: {
    ip: { limit: 30, ttl: 15 * MINUTE },
    email: { limit: 10, ttl: 15 * MINUTE },
  },
  passwordResetConfirm: {
    ip: { limit: 20, ttl: 15 * MINUTE },
  },
  changePassword: {
    user: { limit: 5, ttl: 15 * MINUTE },
  },
} as const satisfies Record<string, Partial<Record<ThrottlerName, RateLimitRule>>>;

// Module-level fallback for each throttler if a route ever enables one without
// giving it a rule of its own. Deliberately the strictest value in use, so a
// mistake fails closed. @RateLimit always sets an explicit rule per route.
export const THROTTLER_FALLBACKS: Record<ThrottlerName, Pick<ThrottlerOptions, 'limit' | 'ttl'>> = {
  ip: { limit: 20, ttl: 15 * MINUTE },
  cooldown: { limit: 1, ttl: MINUTE },
  email: { limit: 5, ttl: HOUR },
  user: { limit: 5, ttl: 15 * MINUTE },
};
