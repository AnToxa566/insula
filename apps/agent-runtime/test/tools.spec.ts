import { describe, expect, it } from 'vitest';

import type { ApiClient, ApiResult } from '../src/api/client.js';
import { idempotencyKey } from '../src/api/idempotency.js';
import { executeToolCall, TOOL_NAMES } from '../src/tools/index.js';

const POST_ID = '0c6d2b8e-4f5a-4b3c-9d1e-7a8b9c0d1e33';

// A stand-in ApiClient that records calls and answers every write with a
// fixed status. The real client is covered end to end in wake.spec.ts.
function fakeApi(status = 204) {
  const calls: Array<[string, ...unknown[]]> = [];
  const answer = <T>(data: T): ApiResult<T> => (status < 300 ? { ok: true, data } : { ok: false, status });
  const api = {
    createPost: async (...args: unknown[]) => (calls.push(['createPost', ...args]), answer({ id: 'new-post' })),
    commentOnPost: async (...args: unknown[]) => (calls.push(['commentOnPost', ...args]), answer(undefined)),
    likePost: async (...args: unknown[]) => (calls.push(['likePost', ...args]), answer(undefined)),
    unlikePost: async (...args: unknown[]) => (calls.push(['unlikePost', ...args]), answer(undefined)),
    followProfile: async (...args: unknown[]) => (calls.push(['followProfile', ...args]), answer(undefined)),
  } as unknown as ApiClient;
  return { api, calls };
}

describe('tools', () => {
  it('exposes exactly the five tools, no more', () => {
    expect([...TOOL_NAMES].sort()).toEqual(
      ['comment_on_post', 'create_post', 'follow_profile', 'like_post', 'unlike_post'].sort(),
    );
  });

  it('drops arguments the schema does not name before calling the API', async () => {
    const { api, calls } = fakeApi();

    const outcome = await executeToolCall(
      { api, toolCallId: 'call_1' },
      { toolName: 'like_post', input: { post_id: POST_ID, agent_id: 'someone-else', profileId: 'x' } },
    );

    expect(outcome).toEqual({ result: { ok: true }, target: POST_ID });
    expect(calls).toEqual([['likePost', POST_ID, 'call_1']]);
  });

  it.each([
    ['unknown tool', { toolName: 'delete_account', input: {} }, 'unknown tool'],
    ['SDK-flagged invalid call', { toolName: 'like_post', input: {}, invalid: true }, 'invalid arguments'],
    ['non-uuid post id', { toolName: 'like_post', input: { post_id: '../agents/x' } }, 'invalid arguments'],
    ['empty post', { toolName: 'create_post', input: { text: '   ' } }, 'invalid arguments'],
    ['oversized comment', { toolName: 'comment_on_post', input: { post_id: POST_ID, text: 'x'.repeat(501) } }, 'invalid arguments'],
    ['malformed handle', { toolName: 'follow_profile', input: { handle: 'no spaces allowed' } }, 'invalid arguments'],
  ])('rejects %s without calling the API', async (_, call, error) => {
    const { api, calls } = fakeApi();

    const outcome = await executeToolCall({ api, toolCallId: 'call_1' }, call);

    expect(outcome.result).toEqual({ ok: false, error });
    expect(calls).toHaveLength(0);
  });

  it('normalises a follow handle the way profiles are stored', async () => {
    const { api, calls } = fakeApi();

    const outcome = await executeToolCall(
      { api, toolCallId: 'call_1' },
      { toolName: 'follow_profile', input: { handle: '  @Nova_Bot ' } },
    );

    expect(outcome).toEqual({ result: { ok: true }, target: 'nova_bot' });
    expect(calls).toEqual([['followProfile', 'nova_bot', 'call_1']]);
  });

  it('returns the new post id from create_post', async () => {
    const { api } = fakeApi(201);

    const outcome = await executeToolCall({ api, toolCallId: 'call_1' }, { toolName: 'create_post', input: { text: 'hi' } });

    expect(outcome).toEqual({ result: { ok: true, post_id: 'new-post' }, target: 'new-post' });
  });

  it.each([
    [404, 'like_post', { post_id: POST_ID }, 'post not found', false],
    [404, 'follow_profile', { handle: 'nova' }, 'profile not found', false],
    [400, 'follow_profile', { handle: 'nova' }, 'cannot follow this profile', false],
    [400, 'create_post', { text: 'hi' }, 'invalid text', false],
    [401, 'like_post', { post_id: POST_ID }, 'not allowed', false],
    [403, 'like_post', { post_id: POST_ID }, 'not allowed', true],
    [500, 'like_post', { post_id: POST_ID }, 'temporarily unavailable', false],
    [0, 'unlike_post', { post_id: POST_ID }, 'temporarily unavailable', false],
  ])('maps API status %i on %s to a fixed error, never upstream text', async (status, toolName, input, error, forbidden) => {
    const { api } = fakeApi(status === 0 ? 599 : status);
    // status 0 ("no usable response") is modelled by overriding one method.
    if (status === 0) {
      (api as { unlikePost: unknown }).unlikePost = async () => ({ ok: false, status: 0 });
    }

    const outcome = await executeToolCall({ api, toolCallId: 'call_1' }, { toolName, input });

    expect(outcome.result).toEqual({ ok: false, error });
    expect(outcome.forbidden === true).toBe(forbidden);
  });
});

describe('idempotencyKey', () => {
  const agentId = 'b1f0c4a8-1c2d-4e5f-8a9b-0c1d2e3f4a55';
  const cycleId = 'c2a1d5b9-2d3e-4f6a-9b0c-1d2e3f4a5b66';

  it('is <agentId>:<cycleId>:<toolCallId> for provider-shaped ids', async () => {
    await expect(idempotencyKey(agentId, cycleId, 'toolu_01A-b_c')).resolves.toBe(`${agentId}:${cycleId}:toolu_01A-b_c`);
  });

  it('hashes a tool call id outside the safe character set instead of copying it into a header', async () => {
    const key = await idempotencyKey(agentId, cycleId, 'call\r\nX-Injected: 1');
    expect(key).toMatch(new RegExp(`^${agentId}:${cycleId}:[0-9a-f]{64}$`));
  });
});
