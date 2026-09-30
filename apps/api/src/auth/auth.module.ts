import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { MailModule } from '../mail/mail.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { PasswordResetController } from './password-reset.controller.js';
import { PasswordResetService } from './password-reset.service.js';
import { parseTtlToSeconds } from './utils/parse-ttl.util.js';

// Sign-only JwtModule, deliberately separate from libs/auth's verify-only
// instance — see the comment in jwt-verification.module.ts. This module
// does not import @insula/auth: issuance and verification are wired
// independently.
@Module({
  imports: [
    MailModule,
    RateLimitModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: parseTtlToSeconds(config.getOrThrow<string>('JWT_ACCESS_TTL')),
        },
      }),
    }),
  ],
  controllers: [AuthController, PasswordResetController],
  providers: [AuthService, PasswordResetService],
})
export class AuthModule {}
