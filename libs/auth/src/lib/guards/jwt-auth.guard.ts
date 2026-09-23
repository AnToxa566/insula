import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import type { Request } from 'express';

import type { AccessTokenPayload } from '@insula/contracts';

import { AGENT_PRINCIPAL_RESOLVER, type AgentPrincipalResolver } from '../agent-principal-resolver.js';
import { ALLOW_AGENT_KEY, IS_PUBLIC_KEY } from '../constants.js';
import { verifyAgentToken } from '../verify-agent-token.js';

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
//
// An agent token only asserts which agent is calling (`sub`). Everything
// else is resolved through the injected AgentPrincipalResolver, and this
// guard is the single place agent status is enforced — for every
// agent-accessible route, not per controller:
//   401 — bad signature, route doesn't allow agents, or no such agent
//         (identity not established)
//   403 — valid token for a real agent that isn't ACTIVE
//         (identity established, action not permitted)
// The split lets the runner tell a broken AGENT_SERVICE_SECRET from a
// paused agent without reading API logs, and leaks nothing: presenting a
// validly signed token for an agent already implies knowing it exists.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    @Inject(AGENT_PRINCIPAL_RESOLVER) private readonly agents: AgentPrincipalResolver,
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

    const agentId = this.tryVerifyAgentToken(token);
    if (agentId) {
      // Checked before the resolver so a route that never accepts agents
      // costs no database read.
      const allowAgent = this.reflector.getAllAndOverride<boolean>(
        ALLOW_AGENT_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowAgent) {
        throw new UnauthorizedException('Agent tokens are not allowed on this route');
      }

      // The signature has verified, so `agentId` is trustworthy enough to
      // log. These lines replace the audit coverage GET /agents/:id/runtime
      // used to get from logging before its own status check.
      const resolved = await this.agents.resolve(agentId);
      if (!resolved) {
        this.logger.warn(`AGENT_AUTH_REJECTED agentId=${agentId} reason=not_found`);
        throw new UnauthorizedException('Invalid or expired access token');
      }
      if (resolved.status !== 'ACTIVE') {
        this.logger.warn(`AGENT_AUTH_REJECTED agentId=${agentId} reason=not_active`);
        throw new ForbiddenException('Agent is not active');
      }

      request.principal = { type: 'agent', agentId, profileId: resolved.profileId };
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

  // Returns the verified agent id (`sub`) — the only claim this guard reads
  // from an agent token.
  private tryVerifyAgentToken(token: string): string | undefined {
    try {
      return verifyAgentToken(token, this.config.getOrThrow<string>('AGENT_SERVICE_SECRET')).sub;
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
