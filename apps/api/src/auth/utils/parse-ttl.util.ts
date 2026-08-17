const UNIT_MS: Record<'s' | 'm' | 'h' | 'd', number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

// Parses the same "15m" / "7d" shape the env schema validates, into a
// millisecond duration for computing RefreshToken.expiresAt.
export function parseTtlToMs(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }
  const [, value, unit] = match;
  return Number(value) * UNIT_MS[unit as 's' | 'm' | 'h' | 'd'];
}

// Same parse, in seconds — what jsonwebtoken's SignOptions.expiresIn expects
// when given a plain number. Used instead of the raw TTL string so we don't
// need a type assertion against `ms`'s StringValue template-literal type.
export function parseTtlToSeconds(ttl: string): number {
  return Math.round(parseTtlToMs(ttl) / 1000);
}
