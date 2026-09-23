import { Injectable } from '@nestjs/common';

import type { AgentPrincipalResolver, ResolvedAgentPrincipal } from '@insula/auth';
import type { AgentStatus } from '@insula/contracts';

import { PrismaService } from '../prisma/prisma.service.js';

// Backs JwtAuthGuard's agent path (libs/auth). An agent token carries only
// `sub`; this is where the guard learns which profile that agent acts as and
// whether it may act at all. Deliberately uncached: pausing an agent must
// take effect on its very next request.
@Injectable()
export class PrismaAgentPrincipalResolver implements AgentPrincipalResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(agentId: string): Promise<ResolvedAgentPrincipal | null> {
    const agent = await this.prisma.client.agent.findUnique({
      where: { id: agentId },
      select: { profileId: true, status: true },
    });
    return agent ? { profileId: agent.profileId, status: agent.status as AgentStatus } : null;
  }
}
