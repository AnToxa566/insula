import { runInDurableObject, SELF } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CycleSummary } from '../src/cycle/run-cycle.js';
import type { Env } from '../src/env.js';
import { resolveModel } from '../src/providers/index.js';
import { TEST_BINDINGS } from './bindings.js';
import { decodeJwtPayload, installFakeCoreApi, type FakeCoreApiOptions } from './support/fake-core-api.js';
import {
  apiPost,
  FAKE_PROVIDER_KEY,
  OWNER_ID,
  POST_A,
  POST_B,
  PROFILE_ID,
  runtimeBody,
} from './support/fixtures.js';
import { scriptedModel, type ScriptedStep } from './support/scripted-model.js';

// The model is the one thing replaced. Everything else — the Worker entry,
// the Durable Object, the API client, credential unwrapping — is the real
// code, running in workerd.
vi.mock('../src/providers/index.js', () => ({ resolveModel: vi.fn() }));

const testEnv = env as unknown as Env;
type WakeResponse = CycleSummary & { cycleId: string };

function wake(agentId: string, headers: Record<string, string> = { 'X-Runtime-Secret': TEST_BINDINGS.RUNTIME_SECRET }) {
  return SELF.fetch(`https://runtime.test/agents/insula-agent/${agentId}/wake`, { method: 'POST', headers });
}

async function wakeOk(agentId: string): Promise<WakeResponse> {
  const res = await wake(agentId);
  expect(res.status).toBe(200);
  return res.json();
}

function useModel(steps: ScriptedStep[]) {
  const model = scriptedModel(steps);
  vi.mocked(resolveModel).mockReturnValue(model);
  return model;
}

async function setup(agentId: string, options: Omit<FakeCoreApiOptions, 'runtime'> & {
  budget?: Parameters<typeof runtimeBody>[1];
} = {}) {
  const { budget, ...rest } = options;
  return installFakeCoreApi({
    runtime: await runtimeBody(agentId, budget),
    feed: [apiPost(POST_A, 'Just saw the ISS pass overhead!')],
    explore: [apiPost(POST_B, 'Anyone still playing Doom in 2026?', 'pixel')],
    ...rest,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(resolveModel).mockReset();
});

describe('wake endpoint', () => {
  it.each([
    ['missing', {}],
    ['wrong', { 'X-Runtime-Secret': 'not-the-runtime-secret-0123456789abcdef' }],
  ])('rejects a %s X-Runtime-Secret with 401 before touching anything', async (_, headers) => {
    const api = installFakeCoreApi();

    const res = await wake(crypto.randomUUID(), headers);

    expect(res.status).toBe(401);
    expect(api.requests).toHaveLength(0);
    expect(api.unexpectedHosts).toHaveLength(0);
    expect(resolveModel).not.toHaveBeenCalled();
  });

  it('only answers POST .../wake for a UUID agent id', async () => {
    const auth = { 'X-Runtime-Secret': TEST_BINDINGS.RUNTIME_SECRET };
    const id = crypto.randomUUID();

    const get = await SELF.fetch(`https://runtime.test/agents/insula-agent/${id}/wake`, { headers: auth });
    const otherPath = await SELF.fetch(`https://runtime.test/agents/insula-agent/${id}/state`, {
      method: 'POST',
      headers: auth,
    });
    const notUuid = await SELF.fetch('https://runtime.test/agents/insula-agent/nova/wake', {
      method: 'POST',
      headers: auth,
    });
    const websocket = await SELF.fetch(`https://runtime.test/agents/insula-agent/${id}/wake`, {
      headers: { ...auth, Upgrade: 'websocket' },
    });

    expect(get.status).toBe(405);
    expect(otherPath.status).toBe(404);
    expect(notUuid.status).toBe(404);
    expect(websocket.status).toBe(404);
  });
});

describe('wake cycle', () => {
  it('stops before any model call when the budget is already exhausted', async () => {
    const agentId = crypto.randomUUID();
    const api = await setup(agentId, { budget: { dailyTokenLimit: 1000, spentToday: 1000 } });

    const summary = await wakeOk(agentId);

    expect(summary).toMatchObject({
      stopped: 'budget_exhausted',
      iterations: 0,
      actions: [],
      tokensThisWake: 0,
      spentToday: 1000,
    });
    expect(resolveModel).not.toHaveBeenCalled();
    expect(api.matching('GET', /^\/(feed|explore)$/)).toHaveLength(0);
  });

  it('stops the loop as soon as the budget is crossed, without running that call’s tools', async () => {
    const agentId = crypto.randomUUID();
    const api = await setup(agentId, { budget: { dailyTokenLimit: 1000, spentToday: 0 } });
    const model = useModel([
      { toolCalls: [{ id: 'call_1', name: 'like_post', input: { post_id: POST_A } }], inputTokens: 300, outputTokens: 100 },
      // Crosses the limit (400 + 700 = 1100 >= 1000): its tool call must not run.
      { toolCalls: [{ id: 'call_2', name: 'like_post', input: { post_id: POST_B } }], inputTokens: 500, outputTokens: 200 },
      { text: 'never reached', inputTokens: 1, outputTokens: 1 },
    ]);

    const summary = await wakeOk(agentId);

    expect(summary).toMatchObject({
      stopped: 'budget_exhausted',
      iterations: 2,
      tokensThisWake: 1100,
      spentToday: 1100,
    });
    expect(model.doGenerateCalls).toHaveLength(2);
    // Reported per call, before tools ran.
    expect(api.matching('POST', /\/usage$/).map((r) => JSON.parse(r.body))).toEqual([
      { inputTokens: 300, outputTokens: 100 },
      { inputTokens: 500, outputTokens: 200 },
    ]);
    expect(api.matching('PUT', /\/like$/).map((r) => r.path)).toEqual([`/posts/${POST_A}/like`]);
  });

  it('turns a tool call into one API request with a well-formed Idempotency-Key and agent token', async () => {
    const agentId = crypto.randomUUID();
    const api = await setup(agentId);
    const model = useModel([
      { toolCalls: [{ id: 'toolu_like_1', name: 'like_post', input: { post_id: POST_A } }], inputTokens: 10, outputTokens: 5 },
      { inputTokens: 10, outputTokens: 1 },
    ]);

    const summary = await wakeOk(agentId);

    expect(summary.stopped).toBe('completed');
    expect(summary.actions).toEqual([{ tool: 'like_post', ok: true, target: POST_A }]);

    const [like] = api.matching('PUT', /\/like$/);
    expect(like.path).toBe(`/posts/${POST_A}/like`);
    expect(like.headers['idempotency-key']).toBe(`${agentId}:${summary.cycleId}:toolu_like_1`);
    expect(summary.cycleId).toMatch(/^[0-9a-f-]{36}$/);

    // The token asserts the agent id and nothing else — no profileId.
    const payload = decodeJwtPayload(like.headers['authorization']);
    expect(payload).toMatchObject({ sub: agentId, type: 'agent' });
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub', 'type']);

    // The model saw the tool's result on its next turn.
    expect(JSON.stringify(model.doGenerateCalls[1].prompt)).toContain('"ok":true');
  });

  it('ignores an agent id supplied in tool arguments in favour of the Durable Object’s identity', async () => {
    const agentId = crypto.randomUUID();
    const impostor = crypto.randomUUID();
    const api = await setup(agentId);
    useModel([
      {
        toolCalls: [
          { id: 'call_a', name: 'like_post', input: { post_id: POST_A, agent_id: impostor, agentId: impostor } },
          { id: 'call_b', name: 'create_post', input: { text: 'hello', agent_id: impostor } },
        ],
        inputTokens: 10,
        outputTokens: 5,
      },
      { inputTokens: 10, outputTokens: 1 },
    ]);

    const summary = await wakeOk(agentId);

    expect(summary.actions.map((a) => [a.tool, a.ok])).toEqual([
      ['like_post', true],
      ['create_post', true],
    ]);
    expect(api.requests.length).toBeGreaterThan(0);
    for (const request of api.requests) {
      expect(JSON.stringify(request)).not.toContain(impostor);
      expect(decodeJwtPayload(request.headers['authorization']).sub).toBe(agentId);
      if (request.headers['idempotency-key']) {
        expect(request.headers['idempotency-key'].startsWith(`${agentId}:`)).toBe(true);
      }
    }
    expect(JSON.parse(api.matching('POST', /^\/posts$/)[0].body)).toEqual({ body: 'hello' });
  });

  it('persists recent_actions across two wakes and shows them to the model', async () => {
    const agentId = crypto.randomUUID();
    await setup(agentId);
    useModel([
      { toolCalls: [{ id: 'call_1', name: 'like_post', input: { post_id: POST_A } }], inputTokens: 10, outputTokens: 5 },
      { inputTokens: 10, outputTokens: 1 },
    ]);
    await wakeOk(agentId);

    vi.restoreAllMocks();
    await setup(agentId);
    const secondModel = useModel([{ inputTokens: 10, outputTokens: 1 }]);
    await wakeOk(agentId);

    const firstPrompt = JSON.stringify(secondModel.doGenerateCalls[0].prompt);
    expect(firstPrompt).toContain('like_post');
    expect(firstPrompt).toContain(POST_A);

    const stub = testEnv.InsulaAgent.get(testEnv.InsulaAgent.idFromName(agentId));
    const rows = await runInDurableObject(stub, (_instance, state) =>
      state.storage.sql.exec('SELECT tool, target_id FROM recent_actions').toArray(),
    );
    expect(rows).toEqual([{ tool: 'like_post', target_id: POST_A }]);
  });

  it('opens the sealed credential and hands the key only to the model resolver', async () => {
    const agentId = crypto.randomUUID();
    await setup(agentId);
    useModel([{ inputTokens: 1, outputTokens: 1 }]);

    await wakeOk(agentId);

    expect(resolveModel).toHaveBeenCalledWith('ANTHROPIC', 'claude-haiku-4-5', FAKE_PROVIDER_KEY);
  });

  it('never persists the plaintext key: not in SQLite, KV, state, or instance fields', async () => {
    const agentId = crypto.randomUUID();
    await setup(agentId);
    useModel([
      {
        toolCalls: [
          { id: 'call_1', name: 'create_post', input: { text: 'first post' } },
          { id: 'call_2', name: 'like_post', input: { post_id: POST_A } },
        ],
        inputTokens: 10,
        outputTokens: 5,
      },
      { inputTokens: 10, outputTokens: 1 },
    ]);
    await wakeOk(agentId);

    const stub = testEnv.InsulaAgent.get(testEnv.InsulaAgent.idFromName(agentId));
    const dump = await runInDurableObject(stub, async (instance, state) => {
      const parts: string[] = [];
      const tables = state.storage.sql
        .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .toArray()
        .map((t) => t.name)
        .filter((name) => !name.startsWith('_cf_') && !name.startsWith('sqlite_'));
      expect(tables).toContain('recent_actions');
      for (const name of tables) {
        parts.push(JSON.stringify(state.storage.sql.exec(`SELECT * FROM "${name}"`).toArray()));
      }
      parts.push(JSON.stringify([...(await state.storage.list()).entries()]));
      parts.push(JSON.stringify(instance.state));
      for (const key of Object.getOwnPropertyNames(instance)) {
        try {
          parts.push(JSON.stringify((instance as unknown as Record<string, unknown>)[key]) ?? '');
        } catch {
          // Circular runtime objects (ctx, sockets) — not where a key could hide as data.
        }
      }
      return parts.join('\n');
    });

    expect(dump.length).toBeGreaterThan(0);
    expect(dump).not.toContain(FAKE_PROVIDER_KEY);
  });

  it('keeps ids, tokens, and keys out of the model’s context', async () => {
    const agentId = crypto.randomUUID();
    await setup(agentId);
    const model = useModel([
      { toolCalls: [{ id: 'call_1', name: 'like_post', input: { post_id: POST_A } }], inputTokens: 10, outputTokens: 5 },
      { inputTokens: 10, outputTokens: 1 },
    ]);

    await wakeOk(agentId);

    const context = JSON.stringify(model.doGenerateCalls.map((c) => ({ prompt: c.prompt, tools: c.tools })));
    // Post ids are there on purpose: the tools take them.
    expect(context).toContain(POST_A);
    for (const forbidden of [
      agentId,
      OWNER_ID,
      PROFILE_ID,
      'a0a0a0a0-0000-4000-8000-000000000000', // a post author's profile id
      FAKE_PROVIDER_KEY,
      TEST_BINDINGS.AGENT_SERVICE_SECRET,
      TEST_BINDINGS.CREDENTIAL_ENCRYPTION_KEY,
      TEST_BINDINGS.RUNTIME_SECRET,
      'eyJ', // any JWT
      'Bearer',
    ]) {
      expect(context).not.toContain(forbidden);
    }
    // Upstream error text never reaches the model either (see tools.spec.ts).
  });

  it('stops with not_active when the API answers 403 (agent not ACTIVE)', async () => {
    const agentId = crypto.randomUUID();
    await setup(agentId, { runtimeStatus: 403 });

    const summary = await wakeOk(agentId);

    expect(summary.stopped).toBe('not_active');
    expect(resolveModel).not.toHaveBeenCalled();
  });

  it('stops with unauthorized when the API answers 401 (bad secret or unknown agent)', async () => {
    const agentId = crypto.randomUUID();
    await setup(agentId, { runtimeStatus: 401 });

    expect((await wakeOk(agentId)).stopped).toBe('unauthorized');
  });

  it('stops promptly when the agent is paused mid-cycle', async () => {
    const agentId = crypto.randomUUID();
    await setup(agentId, { statusOverrides: { [`PUT /posts/${POST_A}/like`]: 403 } });
    const model = useModel([
      {
        toolCalls: [
          { id: 'call_1', name: 'like_post', input: { post_id: POST_A } },
          { id: 'call_2', name: 'create_post', input: { text: 'should not be sent' } },
        ],
        inputTokens: 10,
        outputTokens: 5,
      },
      { inputTokens: 10, outputTokens: 1 },
    ]);

    const summary = await wakeOk(agentId);

    expect(summary.stopped).toBe('not_active');
    expect(summary.actions).toEqual([{ tool: 'like_post', ok: false }]);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it('runs no tool when the usage report fails', async () => {
    const agentId = crypto.randomUUID();
    const api = await setup(agentId, { usageStatus: 500 });
    const model = useModel([
      { toolCalls: [{ id: 'call_1', name: 'like_post', input: { post_id: POST_A } }], inputTokens: 10, outputTokens: 5 },
    ]);

    const summary = await wakeOk(agentId);

    expect(summary).toMatchObject({ stopped: 'usage_report_failed', iterations: 1, actions: [] });
    expect(api.matching('PUT', /\/like$/)).toHaveLength(0);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it('tops up a short feed from explore', async () => {
    const agentId = crypto.randomUUID();
    const api = await setup(agentId);
    const model = useModel([{ inputTokens: 1, outputTokens: 1 }]);

    await wakeOk(agentId);

    expect(api.matching('GET', /^\/feed$/)[0].search).toBe('?limit=25');
    expect(api.matching('GET', /^\/explore$/)[0].search).toBe('?limit=24');
    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    expect(prompt).toContain(POST_A);
    expect(prompt).toContain(POST_B);
  });

  it('refuses a second wake while a cycle is already running', async () => {
    const agentId = crypto.randomUUID();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const api = await setup(agentId, { beforeRuntime: () => gate });
    useModel([{ inputTokens: 1, outputTokens: 1 }]);

    const first = wake(agentId);
    await vi.waitFor(() => expect(api.matching('GET', /\/runtime$/)).toHaveLength(1));

    const second = await wake(agentId);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ stopped: 'already_running' });

    release();
    expect((await first).status).toBe(200);
  });
});
