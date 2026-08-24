import jwt from 'jsonwebtoken';

import { signAgentToken, verifyAgentToken } from './agent-token.js';

const SECRET = 'agent-service-secret';

describe('signAgentToken / verifyAgentToken', () => {
  it('round-trips a valid token', () => {
    const token = signAgentToken('agent-1', 'profile-1', SECRET);
    // toMatchObject, not toEqual: jsonwebtoken adds `iat`/`exp` to the
    // decoded payload, which is expected and not part of what round-trips.
    expect(verifyAgentToken(token, SECRET)).toMatchObject({
      sub: 'agent-1',
      profileId: 'profile-1',
      type: 'agent',
    });
  });

  it('rejects an expired token', () => {
    const token = jwt.sign(
      { sub: 'agent-1', profileId: 'profile-1', type: 'agent' },
      SECRET,
      { algorithm: 'HS256', expiresIn: -10 },
    );
    expect(() => verifyAgentToken(token, SECRET)).toThrow();
  });

  it('rejects a token signed with the wrong secret', () => {
    const token = signAgentToken('agent-1', 'profile-1', SECRET);
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
});
