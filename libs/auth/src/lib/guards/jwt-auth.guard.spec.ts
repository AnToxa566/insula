import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

import type { AccessTokenPayload } from '@insula/contracts';

import { JwtAuthGuard } from './jwt-auth.guard.js';

const SECRET = 'test-secret';

const BASE_PAYLOAD: Omit<AccessTokenPayload, 'type'> = {
  sub: 'user-1',
  profileId: 'profile-1',
  handle: 'tester',
};

function createContext(headers: Record<string, string> = {}) {
  const request = { headers, user: undefined as AccessTokenPayload | undefined };
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
  const jwtService = new JwtService({ secret: SECRET });
  const guard = new JwtAuthGuard(jwtService, reflector);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts a valid token and attaches the decoded payload to the request', async () => {
    const token = await jwtService.signAsync(
      { ...BASE_PAYLOAD, type: 'user' },
      { expiresIn: '1h' },
    );
    const { context, request } = createContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ ...BASE_PAYLOAD, type: 'user' });
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

  it('rejects a validly-signed token whose type is not "user"', async () => {
    const token = await jwtService.signAsync(
      { ...BASE_PAYLOAD, type: 'agent' },
      { expiresIn: '1h' },
    );
    const { context } = createContext({ authorization: `Bearer ${token}` });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lets a @Public() route through without verifying a token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
