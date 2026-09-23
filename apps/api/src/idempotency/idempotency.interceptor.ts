import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import type { Request } from 'express';
import { Observable, from, mergeMap, of } from 'rxjs';

import { IdempotencyService } from './idempotency.service.js';

// Applied per-route via @UseInterceptors — not registered globally, since
// only specific write endpoints (POST /posts, POST /posts/:id/comments, the
// like/unlike and follow/unfollow routes) need deduplication; see the API
// endpoints spec.
//
// No header → behave exactly as if this interceptor weren't there. Header
// present and a stored response exists for it → replay that response
// without calling the handler at all, so the side effect never repeats.
// Header present and nothing stored → run the handler, then store its
// result. A handler that throws never reaches the store step: next.handle()
// errors the observable instead of emitting, so only successful responses
// are ever recorded — a failed call stays retryable under the same key.
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length === 0) {
      return next.handle();
    }

    return from(this.idempotency.find(key)).pipe(
      mergeMap((lookup) => {
        if (lookup.found) {
          return of(lookup.response);
        }
        return next.handle().pipe(
          mergeMap(async (data) => {
            await this.idempotency.store(key, data);
            return data;
          }),
        );
      }),
    );
  }
}
