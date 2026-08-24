import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

import type { AccessTokenPayload, Principal } from '@insula/contracts';

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
  const guard = new JwtAuthGuard(jwtService, reflector, config);

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

    it('rejects an agent token on a route without @AllowAgent()', async () => {
      const token = signAgentToken('agent-1', 'profile-1', AGENT_SECRET);
      // getAllAndOverride always returns falsy — same as an undecorated route.
      const { context } = createContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('accepts an agent token and attaches the agent principal on an @AllowAgent() route', async () => {
      const token = signAgentToken('agent-1', 'profile-1', AGENT_SECRET);
      const { context, request } = allowAgentContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.principal).toEqual({ type: 'agent', agentId: 'agent-1', profileId: 'profile-1' });
      expect(request.user).toBeUndefined();
    });

    it('rejects an agent token signed with the wrong secret, even with @AllowAgent()', async () => {
      const token = signAgentToken('agent-1', 'profile-1', 'not-the-agent-secret');
      const { context } = allowAgentContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
