import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import type { Request } from 'express';

import type { AccessTokenPayload, Principal } from '@insula/contracts';

import { verifyAgentToken } from '../agent-token.js';
import { ALLOW_AGENT_KEY, IS_PUBLIC_KEY } from '../constants.js';

// Registered globally via APP_GUARD in apps/api. Verifies tokens only —
// issuance (signing, refresh rotation, persistence) lives in apps/api/src/auth
// for user tokens, and in this same lib (agent-token.ts) for agent tokens —
// libs/auth stays Prisma-free and apps/*-free so any service can verify a
// token after the monolith splits.
//
// Two token types, two secrets: user tokens verify against JWT_ACCESS_SECRET
// via the injected JwtService; agent tokens verify against
// AGENT_SERVICE_SECRET via the stateless verifyAgentToken(). A route must
// opt in with @AllowAgent() before an agent token is accepted at all — see
// that decorator for why opt-in, not opt-out, is the safe default here.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
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

    const userPayload = await this.tryVerifyUserToken(token);
    if (userPayload) {
      request.user = userPayload;
      request.principal = {
        type: 'user',
        userId: userPayload.sub,
        profileId: userPayload.profileId,
      };
      return true;
    }

    const agentPayload = this.tryVerifyAgentToken(token);
    if (agentPayload) {
      const allowAgent = this.reflector.getAllAndOverride<boolean>(
        ALLOW_AGENT_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowAgent) {
        throw new UnauthorizedException('Agent tokens are not allowed on this route');
      }
      // agentPayload is already Principal-shaped (see tryVerifyAgentToken) —
      // assigned directly, not rebuilt, so there's exactly one place that
      // maps a decoded AgentTokenPayload's `sub` to `agentId`.
      request.principal = agentPayload;
      return true;
    }

    throw new UnauthorizedException('Invalid or expired access token');
  }

  private async tryVerifyUserToken(token: string): Promise<AccessTokenPayload | undefined> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      return undefined;
    }
    // Rejected outright, not inferred from which fields happen to be
    // present — a validly-signed token of the wrong type must not pass just
    // because the signature checks out.
    return payload.type === 'user' ? payload : undefined;
  }

  private tryVerifyAgentToken(token: string): Principal & { type: 'agent' } | undefined {
    try {
      const decoded = verifyAgentToken(token, this.config.getOrThrow<string>('AGENT_SERVICE_SECRET'));
      return { type: 'agent', agentId: decoded.sub, profileId: decoded.profileId };
    } catch {
      return undefined;
    }
  }
}

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }
  return header.slice('Bearer '.length).trim() || undefined;
}
