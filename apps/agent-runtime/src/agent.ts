import { Agent } from 'agents';

import { runCycle, type StopReason } from './cycle/run-cycle.js';
import { parseEnv, type Env } from './env.js';
import { isUuid, json } from './http.js';
import { createMemory, ensureMemorySchema } from './memory/memory.js';
import { resolveModel } from './providers/index.js';

// Operational breadcrumbs only. Everything here is safe to broadcast and to
// persist: no key, no token, no post text.
export interface AgentState {
  lastWake: {
    at: string;
    cycleId: string;
    stopped: StopReason;
    iterations: number;
    tokensThisWake: number;
  } | null;
}

// One Durable Object per agent, named by the agent's id. This class is
// lifecycle only — the wake cycle itself lives in cycle/run-cycle.ts.
//
// Invariant: the decrypted provider key never touches this class. It is
// never passed to setState, never written with this.sql, never assigned to
// a field, never logged. runCycle holds it in a local for one cycle.
export class InsulaAgent extends Agent<Env, AgentState> {
  override initialState: AgentState = { lastWake: null };

  // One DO per agent doesn't by itself serialise cycles: a Durable Object
  // keeps accepting requests while it awaits an outbound fetch, so two
  // wakes could interleave and both spend. This flag makes the second one
  // bounce instead. Holds nothing sensitive.
  #cycleRunning = false;

  override async onStart(): Promise<void> {
    ensureMemorySchema(this.sql.bind(this));
  }

  override async onRequest(request: Request): Promise<Response> {
    if (!new URL(request.url).pathname.endsWith('/wake')) {
      return json({ error: 'not found' }, 404);
    }
    if (request.method !== 'POST') {
      return json({ error: 'method not allowed' }, 405);
    }

    // Identity comes from the Durable Object itself — never from a request
    // body, and never from anything the model produces.
    const agentId = this.name;
    if (!isUuid(agentId)) {
      return json({ error: 'not found' }, 404);
    }
    const config = parseEnv(this.env);
    if (!config) {
      return json({ error: 'misconfigured' }, 500);
    }
    if (this.#cycleRunning) {
      return json({ stopped: 'already_running' }, 409);
    }

    this.#cycleRunning = true;
    const cycleId = crypto.randomUUID();
    try {
      const summary = await runCycle({
        agentId,
        cycleId,
        config,
        memory: createMemory(this.sql.bind(this)),
        // Resolved per call, so the global fetch in effect at wake time is used.
        fetch: (input, init) => fetch(input, init),
        resolveModel,
      });

      this.setState({
        lastWake: {
          at: new Date().toISOString(),
          cycleId,
          stopped: summary.stopped,
          iterations: summary.iterations,
          tokensThisWake: summary.tokensThisWake,
        },
      });
      // One of the runtime's two log lines. Counts and ids only.
      console.log(
        JSON.stringify({
          event: 'wake',
          agentId,
          cycleId,
          stopped: summary.stopped,
          iterations: summary.iterations,
          tokensThisWake: summary.tokensThisWake,
        }),
      );
      return json({ cycleId, ...summary });
    } catch (error) {
      // The other log line. Never the error itself — its message or a
      // provider SDK's attached request config could carry sensitive data.
      // The class name is enough to start looking.
      console.error(
        JSON.stringify({
          event: 'wake_failed',
          agentId,
          cycleId,
          errorName: error instanceof Error ? error.name : 'unknown',
        }),
      );
      return json({ stopped: 'internal_error', cycleId }, 500);
    } finally {
      this.#cycleRunning = false;
    }
  }
}
