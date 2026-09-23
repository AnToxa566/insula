import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Verify-only JwtModule, deliberately separate from the sign-only one in
// apps/api/src/auth/auth.module.ts. Both read JWT_ACCESS_SECRET today, but
// keeping the instances apart means a future move to asymmetric keys (so
// the API can verify but not issue, per SECURITY.md) costs nothing to do.
//
// JwtAuthGuard is deliberately *not* a provider here. It needs an
// AgentPrincipalResolver (AGENT_PRINCIPAL_RESOLVER), which only the
// consuming app can supply — this module has no way to resolve it, so
// declaring the guard here would fail at boot. Consumers register the guard
// as a global APP_GUARD (useClass), which has Nest construct it scoped to
// *their own* module; that module must see JwtService (re-exported below),
// Reflector, ConfigService, and a provider for AGENT_PRINCIPAL_RESOLVER.
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
  exports: [JwtModule],
})
export class JwtVerificationModule {}
