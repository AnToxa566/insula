import { Injectable } from '@nestjs/common';

import { Prisma } from '@insula/db';

import { PrismaService } from '../prisma/prisma.service.js';

type Lookup = { found: true; response: unknown } | { found: false };

// Postgres is the source of truth for "did this write already happen" — an
// isolate can die between a successful side effect and recording that it
// happened, and on retry the caller would otherwise repeat it (e.g. post
// twice). Consumed by IdempotencyInterceptor; kept as its own service so the
// interceptor doesn't touch Prisma directly and so cleanupOlderThan24h has
// somewhere to live.
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async find(key: string): Promise<Lookup> {
    const record = await this.prisma.client.idempotencyRecord.findUnique({ where: { key } });
    return record ? { found: true, response: record.response } : { found: false };
  }

  // Upsert, not create: two requests carrying the same key can race past
  // find() before either has stored — the second upsert becomes a no-op
  // update instead of a duplicate-key error, same posture as
  // TokenBudgetService.recordUsage's concurrency handling.
  //
  // `response` holds whatever the wrapped handler returned, which is
  // `undefined` for the void 204 endpoints (like/unlike, follow/unfollow) —
  // Prisma.JsonNull writes that as the JSON literal `null`, since the column
  // is a required Json, not a nullable one.
  async store(key: string, response: unknown): Promise<void> {
    const value = response === undefined ? Prisma.JsonNull : (response as Prisma.InputJsonValue);
    await this.prisma.client.idempotencyRecord.upsert({
      where: { key },
      create: { key, response: value },
      update: {},
    });
  }

  // Exposed for the caller to schedule — not wired to a cron here (see the
  // API endpoints spec: "Do not schedule it yet — just expose it").
  async cleanupOlderThan24h(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.client.idempotencyRecord.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return count;
  }
}
