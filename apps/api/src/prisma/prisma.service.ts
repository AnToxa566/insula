import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { prisma } from '@insula/db';

// Composes the libs/db singleton rather than subclassing PrismaClient —
// subclassing would spin up a second PrismaPg connection pool. This just
// gives the existing singleton a Nest lifecycle (connect on boot, disconnect
// on shutdown).
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client = prisma;

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
