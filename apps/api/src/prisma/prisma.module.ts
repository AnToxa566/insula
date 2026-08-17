import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

// Global: this is monolith-wide DB access infra, not an auth-module concern.
// Future modules (social, chat) will inject PrismaService the same way.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
