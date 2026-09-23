import jwt from 'jsonwebtoken';

import { AGENT_TOKEN_TTL_SECONDS, signAgentToken } from './agent-token.js';
import { verifyAgentToken } from './verify-agent-token.js';

const SECRET = 'agent-service-secret';

// signAgentToken is hand-rolled on WebCrypto (it must run in a Workers
// isolate); verifyAgentToken is jsonwebtoken. These tests are what pins the
// two to the same HS256 JWT format.
describe('signAgentToken / verifyAgentToken', () => {
  it('round-trips a valid token', async () => {
    const token = await signAgentToken('agent-1', SECRET);
    expect(verifyAgentToken(token, SECRET)).toEqual({ sub: 'agent-1', type: 'agent' });
  });

  it('signs HS256 with a 5-minute expiry and no claims beyond sub/type/iat/exp', async () => {
    const token = await signAgentToken('agent-1', SECRET);
    const decoded = jwt.decode(token, { complete: true });

    expect(decoded?.header).toEqual({ alg: 'HS256', typ: 'JWT' });
    const payload = decoded?.payload as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub', 'type']);
    expect((payload['exp'] as number) - (payload['iat'] as number)).toBe(AGENT_TOKEN_TTL_SECONDS);
  });

  it('rejects an expired token', () => {
    const token = jwt.sign({ sub: 'agent-1', type: 'agent' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: -10,
    });
    expect(() => verifyAgentToken(token, SECRET)).toThrow();
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = await signAgentToken('agent-1', SECRET);
    expect(() => verifyAgentToken(token, 'a-different-secret')).toThrow();
  });

  // A user access token is a differently-shaped payload (type: 'user',
  // carries `handle`, no agent semantics). Even if it were ever signed with
  // the agent secret, verifyAgentToken must reject it on shape alone — the
  // type check is not just a signature check.
  it('rejects a user-shaped token even when signed with the agent secret', () => {
    const token = jwt.sign(
      { sub: 'user-1', profileId: 'profile-1', handle: 'tester', type: 'user' },
      SECRET,
      { algorithm: 'HS256', expiresIn: '5m' },
    );
    expect(() => verifyAgentToken(token, SECRET)).toThrow();
  });

  // Tokens no longer carry a profileId. One that does (an old token, or a
  // forged claim) must not have it surface to callers — the guard resolves
  // the profile from `sub` alone.
  it('drops claims beyond sub/type, such as a stray profileId', () => {
    const token = jwt.sign({ sub: 'agent-1', profileId: 'someone-elses-profile', type: 'agent' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: '5m',
    });
    expect(verifyAgentToken(token, SECRET)).toEqual({ sub: 'agent-1', type: 'agent' });
  });
});
