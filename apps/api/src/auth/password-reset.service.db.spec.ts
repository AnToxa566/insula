import * as bcrypt from 'bcrypt';

import { prisma } from '@insula/db';

import type { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordResetService } from './password-reset.service.js';

// Runs against the real Postgres (see jest.db.config.cts) — not part of the
// DB-free unit run.
//
// Why this exists: the HTTP throttlers (per-IP, and the per-email 1/60s
// cooldown) answer 429 before a second /request ever reaches the service, so
// the database-level cooldown in PasswordResetService.request — updateMany
// (count 0) -> create -> unique violation (P2002) inside an interactive
// transaction -> silent 202 — is only reachable by calling the service
// directly. Mail is a recording stand-in; everything else is production code.

jest.setTimeout(30_000);

// Shares the e2e cleanup convention: `e2e-pwreset-` users are test data.
const EMAIL_PREFIX = 'e2e-pwreset-service-';
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
let counter = 0;

async function createUser() {
  const suffix = `${Date.now().toString(36)}${(counter += 1)}${Math.random().toString(36).slice(2, 6)}`;
  const profile = await prisma.profile.create({
    data: {
      type: 'USER',
      handle: `svc${suffix}`.slice(0, 20),
      displayName: 'Service race test',
      avatarSeed: suffix,
    },
  });
  return prisma.user.create({
    data: {
      email: `${EMAIL_PREFIX}${suffix}@example.com`,
      passwordHash: 'not-a-real-hash',
      profileId: profile.id,
    },
  });
}

function build() {
  const sent: { to: string; code: string }[] = [];
  const mail = {
    sendPasswordResetCode: jest.fn(async (to: string, code: string) => {
      sent.push({ to, code });
    }),
  } as unknown as MailService;
  return { service: new PasswordResetService(new PrismaService(), mail), sent };
}

// Records the error code of every transaction that rolled back, so a test can
// prove the unique-violation path really ran (not merely that nothing threw).
function watchRolledBackTransactions() {
  const codes: unknown[] = [];
  const original = prisma.$transaction.bind(prisma) as (...args: unknown[]) => Promise<unknown>;
  const spy = jest.spyOn(prisma, '$transaction').mockImplementation(((...args: unknown[]) =>
    original(...args).catch((err: { code?: unknown }) => {
      codes.push(err?.code);
      throw err;
    })) as never);
  return { codes, stop: () => spy.mockRestore() };
}

const rowsFor = (userId: string) => prisma.passwordReset.findMany({ where: { userId } });

describe('PasswordResetService.request against the real database', () => {
  afterAll(async () => {
    // Profile -> User -> PasswordReset all cascade from the profile.
    await prisma.profile.deleteMany({ where: { user: { email: { startsWith: EMAIL_PREFIX } } } });
    await prisma.$disconnect();
  });

  it('two parallel first requests: one row, one mail, no error, and the row holds the mailed code', async () => {
    const user = await createUser();
    const { service, sent } = build();
    const watch = watchRolledBackTransactions();

    const results = await Promise.allSettled([
      service.request({ email: user.email }),
      service.request({ email: user.email }),
    ]);
    watch.stop();
    await flush();

    // The loser hits the unique constraint inside the transaction; that must
    // be swallowed (same 202 body), never surface as a 500.
    expect(watch.codes).toEqual(['P2002']);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    const found = await rowsFor(user.id);
    expect(found).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(user.email);
    expect(await bcrypt.compare(sent[0].code, found[0].codeHash)).toBe(true);
  });

  it('parallel requests after the cooldown has passed: one rewrite, one mail, no error', async () => {
    const user = await createUser();
    const { service, sent } = build();

    await service.request({ email: user.email });
    await flush();
    expect(sent).toHaveLength(1);
    // Age the row past RESEND_COOLDOWN so the UPDATE path is the live one.
    await prisma.passwordReset.updateMany({
      where: { userId: user.id },
      data: { createdAt: new Date(Date.now() - 5 * 60_000) },
    });

    const watch = watchRolledBackTransactions();
    const results = await Promise.allSettled([
      service.request({ email: user.email }),
      service.request({ email: user.email }),
      service.request({ email: user.email }),
    ]);
    watch.stop();
    await flush();

    // One winner; the two others each fell through to the insert and lost it.
    expect(watch.codes).toEqual(['P2002', 'P2002']);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    const found = await rowsFor(user.id);
    expect(found).toHaveLength(1);
    expect(sent).toHaveLength(2);
    // The stored code is the one from the winning (second) mail.
    expect(await bcrypt.compare(sent[1].code, found[0].codeHash)).toBe(true);
  });

  it('a second request inside the cooldown is a silent no-op', async () => {
    const user = await createUser();
    const { service, sent } = build();

    await service.request({ email: user.email });
    await flush();
    const [before] = await rowsFor(user.id);

    await expect(service.request({ email: user.email })).resolves.toEqual({
      message: expect.any(String),
    });
    await flush();

    expect(sent).toHaveLength(1);
    const after = await rowsFor(user.id);
    expect(after).toHaveLength(1);
    expect(after[0].codeHash).toBe(before.codeHash);
  });

  it('the pool stays usable after the swallowed unique violation', async () => {
    const user = await createUser();
    const { service } = build();

    await Promise.all([service.request({ email: user.email }), service.request({ email: user.email })]);
    await flush();

    // A failed statement aborts a Postgres transaction; if that leaked onto a
    // pooled connection, follow-up queries would fail.
    await expect(prisma.user.count({ where: { email: user.email } })).resolves.toBe(1);
    await expect(rowsFor(user.id)).resolves.toHaveLength(1);
  });
});
