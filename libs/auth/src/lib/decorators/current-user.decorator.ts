import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { Request } from 'express';

import type { AccessTokenPayload } from '@insula/contracts';

// Reads the payload JwtAuthGuard already verified and attached to the
// request. Only meaningful behind the guard — on a @Public() route with no
// token, this resolves to undefined.
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    return ctx.switchToHttp().getRequest<Request>().user as AccessTokenPayload;
  },
);
