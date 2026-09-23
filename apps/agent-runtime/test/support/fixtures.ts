import { bytesToBase64, credentialAad, LocalKekProvider, sealCredential } from '@insula/crypto';

import { TEST_BINDINGS } from '../bindings.js';

// Obviously fake. No real provider key appears anywhere in this suite.
export const FAKE_PROVIDER_KEY = 'sk-test-not-a-real-key-0000';

export const OWNER_ID = '7f1c3a52-0b1e-4c7d-9a3f-2e5b8c9d0a11';
export const PROFILE_ID = '3b9e6f70-1d2c-4e8a-b5f4-6a7c8d9e0f22';
export const POST_A = '0c6d2b8e-4f5a-4b3c-9d1e-7a8b9c0d1e33';
export const POST_B = '1d7e3c9f-5a6b-4c4d-8e2f-8b9c0d1e2f44';

export async function sealedCredential(ownerId: string, agentId: string, plaintext = FAKE_PROVIDER_KEY) {
  const sealed = await sealCredential(
    plaintext,
    credentialAad(ownerId, agentId),
    new LocalKekProvider(TEST_BINDINGS.CREDENTIAL_ENCRYPTION_KEY),
  );
  return {
    ciphertext: bytesToBase64(sealed.ciphertext),
    iv: bytesToBase64(sealed.iv),
    authTag: bytesToBase64(sealed.authTag),
    encryptedDek: bytesToBase64(sealed.encryptedDek),
    kekVersion: sealed.kekVersion,
  };
}

export interface BudgetFixture {
  dailyTokenLimit: number;
  spentToday: number;
  exhausted: boolean;
}

// The full GET /agents/:id/runtime body, profileId included — the runtime
// is expected to drop what it doesn't need.
export async function runtimeBody(agentId: string, budget: Partial<BudgetFixture> = {}) {
  const dailyTokenLimit = budget.dailyTokenLimit ?? 50_000;
  const spentToday = budget.spentToday ?? 0;
  return {
    agent: {
      id: agentId,
      profileId: PROFILE_ID,
      ownerId: OWNER_ID,
      handle: 'nova',
      displayName: 'Nova',
      bio: 'Space nerd, retro games.',
      provider: 'ANTHROPIC',
      model: 'claude-haiku-4-5',
      interests: ['space', 'retro games'],
      activeHours: [9, 10, 11],
      timezone: 'UTC',
      status: 'ACTIVE',
    },
    credential: await sealedCredential(OWNER_ID, agentId),
    budget: {
      dailyTokenLimit,
      spentToday,
      remaining: Math.max(0, dailyTokenLimit - spentToday),
      exhausted: budget.exhausted ?? spentToday >= dailyTokenLimit,
    },
  };
}

// A PostResponse as the API returns it, author profile id and all.
export function apiPost(id: string, body: string, authorHandle = 'orbit') {
  return {
    id,
    body,
    mediaUrls: [],
    createdAt: '2026-09-23T10:00:00.000Z',
    author: {
      id: 'a0a0a0a0-0000-4000-8000-000000000000',
      handle: authorHandle,
      displayName: authorHandle.toUpperCase(),
      avatarSeed: 'seed',
      avatarUrl: null,
      type: 'USER',
    },
    likeCount: 2,
    commentCount: 1,
    likedByMe: false,
  };
}
