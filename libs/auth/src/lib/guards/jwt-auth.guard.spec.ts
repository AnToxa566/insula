import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

import jwt from 'jsonwebtoken';

import type { AccessTokenPayload, Principal } from '@insula/contracts';

import type { AgentPrincipalResolver, ResolvedAgentPrincipal } from '../agent-principal-resolver.js';
import { signAgentToken } from '../agent-token.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const USER_SECRET = 'test-secret';
const AGENT_SECRET = 'test-agent-secret';

const BASE_PAYLOAD: Omit<AccessTokenPayload, 'type'> = {
  sub: 'user-1',
  profileId: 'profile-1',
  handle: 'tester',
};

function createContext(headers: Record<string, string> = {}) {
  const request = {
    headers,
    user: undefined as AccessTokenPayload | undefined,
    principal: undefined as Principal | undefined,
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
    getHandler: () => function handler() {
      return undefined;
    },
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('JwtAuthGuard', () => {
  const reflector = new Reflector();
  const jwtService = new JwtService({ secret: USER_SECRET });
  const config = { getOrThrow: (key: string) => (key === 'AGENT_SERVICE_SECRET' ? AGENT_SECRET : undefined) } as ConfigService;
  // Stands in for apps/api's Prisma-backed resolver. Tests set `agents` to
  // control what exists; `resolve` is a jest.fn so tests can assert whether
  // the guard reached the database at all.
  let agents: Record<string, ResolvedAgentPrincipal> = {};
  const resolver = {
    resolve: jest.fn(async (agentId: string) => agents[agentId] ?? null),
  } satisfies AgentPrincipalResolver;
  const guard = new JwtAuthGuard(jwtService, reflector, config, resolver);

  beforeEach(() => {
    agents = { 'agent-1': { profileId: 'profile-1', status: 'ACTIVE' } };
    resolver.resolve.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts a valid user token and attaches user + principal to the request', async () => {
    const token = await jwtService.signAsync(
      { ...BASE_PAYLOAD, type: 'user' },
      { expiresIn: '1h' },
    );
    const { context, request } = createContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ ...BASE_PAYLOAD, type: 'user' });
    expect(request.principal).toEqual({ type: 'user', userId: 'user-1', profileId: 'profile-1' });
  });

  it('rejects an expired token', async () => {
    const token = await jwtService.signAsync(
      { ...BASE_PAYLOAD, type: 'user' },
      { expiresIn: -10 },
    );
    const { context } = createContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token with a tampered signature', async () => {
    const token = await jwtService.signAsync(
      { ...BASE_PAYLOAD, type: 'user' },
      { expiresIn: '1h' },
    );
    const [header, payload, signature] = token.split('.');
    const flippedChar = signature[0] === 'A' ? 'B' : 'A';
    const tampered = `${header}.${payload}.${flippedChar}${signature.slice(1)}`;
    const { context } = createContext({ authorization: `Bearer ${tampered}` });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lets a @Public() route through without verifying a token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  describe('agent tokens', () => {
    function allowAgentContext(headers: Record<string, string>) {
      const { context, request } = createContext(headers);
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        // First getAllAndOverride call is the IS_PUBLIC_KEY check; the
        // second (only reached for a would-be agent token) is ALLOW_AGENT_KEY.
        return key === 'allowAgent';
      });
      return { context, request };
    }

    it('rejects an agent token on a route without @AllowAgent(), without touching the resolver', async () => {
      const token = await signAgentToken('agent-1', AGENT_SECRET);
      // getAllAndOverride always returns falsy — same as an undecorated route.
      const { context } = createContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it('accepts an ACTIVE agent and attaches the principal on an @AllowAgent() route', async () => {
      const token = await signAgentToken('agent-1', AGENT_SECRET);
      const { context, request } = allowAgentContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.principal).toEqual({ type: 'agent', agentId: 'agent-1', profileId: 'profile-1' });
      expect(request.user).toBeUndefined();
    });

    // The escalation this design closes: a token claiming someone else's
    // profileId (a human's, say) must not become that profile.
    it('takes profileId from the resolver, never from a token claim', async () => {
      const token = jwt.sign({ sub: 'agent-1', profileId: 'a-humans-profile', type: 'agent' }, AGENT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '5m',
      });
      const { context, request } = allowAgentContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.principal).toEqual({ type: 'agent', agentId: 'agent-1', profileId: 'profile-1' });
    });

    it('rejects a validly signed token for an agent that does not exist with 401', async () => {
      const token = await signAgentToken('no-such-agent', AGENT_SECRET);
      const { context, request } = allowAgentContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(request.principal).toBeUndefined();
    });

    it.each(['PAUSED', 'DRAFT'] as const)('rejects a %s agent with 403', async (status) => {
      agents['agent-1'] = { profileId: 'profile-1', status };
      const token = await signAgentToken('agent-1', AGENT_SECRET);
      const { context, request } = allowAgentContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(request.principal).toBeUndefined();
    });

    it('rejects an agent token signed with the wrong secret, even with @AllowAgent()', async () => {
      const token = await signAgentToken('agent-1', 'not-the-agent-secret');
      const { context } = allowAgentContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(resolver.resolve).not.toHaveBeenCalled();
    });
  });
});
