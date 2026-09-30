import { Controller, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';

import { RateLimit } from './rate-limit.decorator.js';
import { RateLimitModule } from './rate-limit.module.js';

const MINUTE = 60_000;

@Controller('probe')
class ProbeController {
  @Post('ip')
  @RateLimit({ ip: { limit: 2, ttl: MINUTE } })
  ip() {
    return { ok: true };
  }

  @Post('email')
  @RateLimit({
    cooldown: { limit: 1, ttl: MINUTE },
    email: { limit: 3, ttl: MINUTE },
  })
  email() {
    return { ok: true };
  }

  @Post('user')
  @RateLimit({ user: { limit: 1, ttl: MINUTE } })
  user() {
    return { ok: true };
  }
}

// End to end through the real ThrottlerGuard: proves the module wiring, that
// @RateLimit applies only the throttlers it names, and that the trackers are
// what each throttler actually keys on.
describe('RateLimitModule + @RateLimit', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RateLimitModule],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    // Stands in for JwtAuthGuard, which runs before route guards in the app:
    // the test picks the "authenticated user" from a header.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const sub = req.header('x-test-sub');
      if (sub) (req as Request & { user?: unknown }).user = { sub };
      next();
    });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (path: string, init: { body?: unknown; headers?: Record<string, string> } = {}) =>
    fetch(`${baseUrl}/probe/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...init.headers },
      body: JSON.stringify(init.body ?? {}),
    });

  it('returns 429 once the per-IP limit is exhausted', async () => {
    expect((await post('ip')).status).toBe(201);
    expect((await post('ip')).status).toBe(201);
    expect((await post('ip')).status).toBe(429);
  });

  it('applies the cooldown per email, normalised, regardless of case or whitespace', async () => {
    expect((await post('email', { body: { email: 'cool@example.com' } })).status).toBe(201);
    expect((await post('email', { body: { email: ' COOL@example.com ' } })).status).toBe(429);
    // A different email is unaffected.
    expect((await post('email', { body: { email: 'other@example.com' } })).status).toBe(201);
  });

  it('does not apply the ip throttler to a route that did not name it', async () => {
    // /probe/email names cooldown + email only; different emails each pass
    // well beyond the 2-hit ip limit used by /probe/ip.
    for (let i = 0; i < 4; i++) {
      expect((await post('email', { body: { email: `fresh-${i}@example.com` } })).status).toBe(201);
    }
  });

  it('keys the user throttler on the authenticated subject', async () => {
    expect((await post('user', { headers: { 'x-test-sub': 'user-a' } })).status).toBe(201);
    expect((await post('user', { headers: { 'x-test-sub': 'user-a' } })).status).toBe(429);
    expect((await post('user', { headers: { 'x-test-sub': 'user-b' } })).status).toBe(201);
  });
});
