import { createHash } from 'node:crypto';

import { emailTracker, ipTracker, userTracker } from './rate-limit.trackers.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('ipTracker', () => {
  it('keys on the request address', () => {
    expect(ipTracker({ ip: '203.0.113.7' })).toBe('ip:203.0.113.7');
  });

  it('folds IPv6 addresses in one /64 into the same bucket', () => {
    expect(ipTracker({ ip: '2001:db8::1' })).toBe(ipTracker({ ip: '2001:db8::ffff' }));
    expect(ipTracker({ ip: '2001:db8::1' })).not.toBe(ipTracker({ ip: '2001:db9::1' }));
  });

  it('falls back to one shared bucket when there is no address', () => {
    expect(ipTracker({})).toBe(ipTracker({ ip: '' }));
    expect(ipTracker({})).toMatch(/^ip:/);
  });
});

describe('emailTracker', () => {
  it('keys on the sha256 of the email, never the address itself', () => {
    const key = emailTracker({ body: { email: 'alice@example.com' } });
    expect(key).toBe(`email:${sha256('alice@example.com')}`);
    expect(key).not.toContain('alice');
  });

  it('normalises case and surrounding whitespace itself', () => {
    const canonical = emailTracker({ body: { email: 'alice@example.com' } });
    expect(emailTracker({ body: { email: '  Alice@Example.COM ' } })).toBe(canonical);
  });

  it('separates different emails', () => {
    expect(emailTracker({ body: { email: 'alice@example.com' } })).not.toBe(
      emailTracker({ body: { email: 'bob@example.com' } }),
    );
  });

  it.each([
    ['a missing body', undefined],
    ['an empty body', {}],
    ['a numeric email', { email: 42 }],
    ['an array email', { email: ['a@b.co'] }],
    ['an object email', { email: { $ne: null } }],
  ])('falls back to the IP for %s', (_label, body) => {
    expect(emailTracker({ ip: '203.0.113.7', body })).toBe('ip:203.0.113.7');
  });
});

describe('userTracker', () => {
  it('keys on the JWT subject', () => {
    expect(userTracker({ ip: '203.0.113.7', user: { sub: 'user-1' } })).toBe('user:user-1');
  });

  it('separates users behind the same address', () => {
    expect(userTracker({ ip: '203.0.113.7', user: { sub: 'user-1' } })).not.toBe(
      userTracker({ ip: '203.0.113.7', user: { sub: 'user-2' } }),
    );
  });

  it('falls back to the IP when there is no authenticated user', () => {
    expect(userTracker({ ip: '203.0.113.7' })).toBe('ip:203.0.113.7');
    expect(userTracker({ ip: '203.0.113.7', user: { sub: 42 } })).toBe('ip:203.0.113.7');
  });
});
