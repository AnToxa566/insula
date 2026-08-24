import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { Request } from 'express';

import type { Principal } from '@insula/contracts';

// Reads the principal JwtAuthGuard attached to the request, regardless of
// whether it was a user or an agent token — for routes marked @AllowAgent().
// User-only routes should keep using @CurrentUser(), which carries the
// richer AccessTokenPayload (handle, etc.) that only ever exists for users.
export const CurrentPrincipal = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Principal => {
    return ctx.switchToHttp().getRequest<Request>().principal as Principal;
  },
);
