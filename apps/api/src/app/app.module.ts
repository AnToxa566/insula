import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { JwtAuthGuard, JwtVerificationModule } from '@insula/auth';

import { AuthModule } from '../auth/auth.module.js';
import { validateEnv } from '../config/env.validation.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SocialModule } from '../social/social.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    JwtVerificationModule,
    PrismaModule,
    AuthModule,
    SocialModule,
  ],
  providers: [
    // Registered globally: opt-out (@Public()) is safer than opt-in — a
    // route that forgets its decorator stays protected rather than exposed.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
