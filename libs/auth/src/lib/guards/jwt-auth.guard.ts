import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import type { Request } from 'express';

import type { AccessTokenPayload } from '@insula/contracts';

import { IS_PUBLIC_KEY } from '../constants.js';

// Registered globally via APP_GUARD in apps/api. Verifies the access token
// only — issuance (signing, refresh rotation, persistence) lives in
// apps/api/src/auth, never here. libs/auth must stay Prisma-free and
// apps/*-free so any service can verify a token after the monolith splits.
//
// Agent service tokens (type: 'agent', short-lived, signed by agent-runtime
// with AGENT_SERVICE_SECRET — see SECURITY.md) will arrive on these same
// endpoints once agents can call the API directly. When that lands, this
// guard gains a second verification path (or a sibling AgentAuthGuard).
// Not implemented yet — there is nothing to protect with an agent guard
// until issuance exists.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // Rejected outright, not inferred from which fields happen to be
    // present — an agent token will carry different claims later and must
    // not be accepted here just because the signature checks out.
    if (payload.type !== 'user') {
      throw new UnauthorizedException('Invalid token type');
    }

    request.user = payload;
    return true;
  }
}

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }
  return header.slice('Bearer '.length).trim() || undefined;
}
