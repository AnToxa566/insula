import { Module } from '@nestjs/common';

import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import { IdempotencyService } from './idempotency.service.js';

// No `imports`: PrismaModule is @Global(), same as social.module.ts. Exports
// both the service (for a future cleanup scheduler) and the interceptor
// (for @UseInterceptors on the write routes that need it).
@Module({
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
