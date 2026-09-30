const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// How long the emailed 6-digit code can be entered. The mail copy states this
// figure: keep it in step with CODE_TTL_MINUTES in mail/mail.service.ts (the
// two are separate because mail is infrastructure and must not import auth).
export const CODE_TTL = 10 * MINUTE;

// How long the single-use reset token (issued by /verify) can be redeemed at
// /confirm.
export const TOKEN_TTL = 15 * MINUTE;

// Wrong guesses allowed per code. Enforced in Postgres (an atomic increment
// guarded by `attempts < MAX`), so parallel guesses can't exceed it and it
// holds across API instances.
export const MAX_CODE_ATTEMPTS = 5;

// Minimum gap between two codes issued to one user. Also enforced in Postgres
// via `createdAt` — the in-memory throttler is only a second, per-process layer.
export const RESEND_COOLDOWN = 60 * SECOND;

// A record is live for at most CODE_TTL + TOKEN_TTL (~25 min); anything older
// than this is garbage.
export const STALE_RECORD_AGE = 24 * HOUR;

// Request-triggered cleanup runs at most this often per instance.
export const CLEANUP_MIN_INTERVAL = 10 * MINUTE;

export const REQUEST_ACCEPTED_MESSAGE =
  'If an account exists for this email, a verification code has been sent.';
