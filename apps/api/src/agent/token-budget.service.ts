import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';

import type { BudgetResponse } from '@insula/contracts';

import { PrismaService } from '../prisma/prisma.service.js';

// Postgres (TokenUsage) is the single source of truth for spend — see
// ARCHITECTURE.md "token_usage is a mechanism, not analytics". Budget
// exhaustion is derived here at read time and never written back to
// Agent.status, so restoring a user's intended status after they raise the
// limit or a new day starts is never a state to reconcile.
@Injectable()
export class TokenBudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async getBudget(agentId: string, dailyTokenLimit: number, timezone: string): Promise<BudgetResponse> {
    const spentToday = await this.getSpentToday(agentId, timezone);
    return {
      dailyTokenLimit,
      spentToday,
      remaining: Math.max(0, dailyTokenLimit - spentToday),
      exhausted: spentToday >= dailyTokenLimit,
    };
  }

  // Throws 429 when today's usage already meets or exceeds the limit.
  // Exposed for the runner-facing endpoints (agent-runtime, built in the
  // Cloudflare iteration) to call before starting a model-call cycle — the
  // hard stop SECURITY.md requires "per loop iteration", enforced in code
  // rather than left to a prompt instruction.
  async assertBudgetAvailable(agentId: string): Promise<void> {
    const agent = await this.prisma.client.agent.findUnique({
      where: { id: agentId },
      select: { dailyTokenLimit: true, timezone: true },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    const spentToday = await this.getSpentToday(agentId, agent.timezone);
    if (spentToday >= agent.dailyTokenLimit) {
      throw new HttpException('Daily token budget exhausted', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  // Atomic upsert-with-increment: Prisma compiles this to a single Postgres
  // INSERT ... ON CONFLICT DO UPDATE, so two concurrent calls for the same
  // agent/day both land instead of the second clobbering the first's write
  // — a plain read-then-write here would lose updates under concurrency.
  async recordUsage(
    agentId: string,
    inputTokens: number,
    outputTokens: number,
    timezone: string,
  ): Promise<void> {
    const day = todayInTimezone(timezone);
    await this.prisma.client.tokenUsage.upsert({
      where: { agentId_day: { agentId, day } },
      create: { agentId, day, inputTokens, outputTokens, callCount: 1 },
      update: {
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        callCount: { increment: 1 },
      },
    });
  }

  private async getSpentToday(agentId: string, timezone: string): Promise<number> {
    const day = todayInTimezone(timezone);
    const usage = await this.prisma.client.tokenUsage.findUnique({
      where: { agentId_day: { agentId, day } },
    });
    return (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
  }
}

// The `day` column is @db.Date (no time component). "Today" is computed in
// the agent's own timezone, not the server's — an agent in Tokyo and one in
// Los Angeles cross midnight at different server-clock instants, and each
// must be compared against a TokenUsage row for their own local day.
function todayInTimezone(timezone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}
