import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

// Verify-only JwtModule, deliberately separate from the sign-only one in
// apps/api/src/auth/auth.module.ts. Both read JWT_ACCESS_SECRET today, but
// keeping the instances apart means a future move to asymmetric keys (so
// the API can verify but not issue, per SECURITY.md) costs nothing to do.
//
// JwtModule is re-exported alongside JwtAuthGuard, not just the guard: a
// consumer registering JwtAuthGuard as a global APP_GUARD (useClass) has
// Nest construct a fresh instance scoped to *its own* module, so JwtService
// must be visible there too — exporting only the guard leaves that
// construction unable to resolve JwtService and fails at boot.
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard],
})
export class JwtVerificationModule {}
