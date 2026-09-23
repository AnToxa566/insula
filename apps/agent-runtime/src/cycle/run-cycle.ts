import { generateText, type ModelMessage, type ToolResultPart } from 'ai';

import { createApiClient, type ApiClient } from '../api/client.js';
import type { FeedPost } from '../api/schemas.js';
import { BudgetGuard } from '../budget/budget-guard.js';
import { openRuntimeCredential } from '../credentials/open-credential.js';
import type { RuntimeConfig } from '../env.js';
import type { Memory } from '../memory/memory.js';
import type { resolveModel } from '../providers/index.js';
import { buildTools, executeToolCall, TOOL_NAMES } from '../tools/index.js';
import { buildWakeMessage, mergePosts } from './build-context.js';
import { buildSystemPrompt } from './system-prompt.js';

export const MAX_ITERATIONS = 5;
export const FEED_SIZE = 25;
export const RECENT_ACTIONS_IN_CONTEXT = 20;
const MAX_OUTPUT_TOKENS = 1024;
const MODEL_TIMEOUT_MS = 60_000;

export type StopReason =
  | 'completed'
  | 'max_iterations'
  | 'budget_exhausted'
  // 403 from the API: the agent exists but isn't ACTIVE (JwtAuthGuard).
  | 'not_active'
  // 401 from the API: bad AGENT_SERVICE_SECRET, or no such agent.
  | 'unauthorized'
  | 'not_found'
  | 'runtime_unavailable'
  | 'credential_error'
  | 'feed_unavailable'
  | 'model_error'
  | 'usage_unavailable'
  | 'usage_report_failed';

export interface CycleAction {
  tool: string;
  ok: boolean;
  target?: string;
}

export interface CycleSummary {
  stopped: StopReason;
  iterations: number;
  actions: CycleAction[];
  tokensThisWake: number;
  // null when the cycle stopped before the API reported a figure.
  spentToday: number | null;
}

export interface CycleDeps {
  // The Durable Object's own name. The only source of identity in a cycle.
  agentId: string;
  cycleId: string;
  config: RuntimeConfig;
  memory: Memory;
  fetch: typeof fetch;
  resolveModel: typeof resolveModel;
}

// One wake: fetch config and sealed credential, unwrap the key, read the
// feed, then a bounded tool-calling loop.
//
// The decrypted key (`apiKey`) and the model built from it exist only as
// locals in this function. Neither is returned, stored, or logged; the next
// wake fetches and unwraps again.
export async function runCycle(deps: CycleDeps): Promise<CycleSummary> {
  const { agentId, config, memory } = deps;
  const api = createApiClient({
    baseUrl: config.coreApiUrl,
    agentId,
    agentServiceSecret: config.agentServiceSecret,
    cycleId: deps.cycleId,
    fetch: deps.fetch,
  });
  const stopEarly = (stopped: StopReason, spentToday: number | null = null): CycleSummary => ({
    stopped,
    iterations: 0,
    actions: [],
    tokensThisWake: 0,
    spentToday,
  });

  const runtime = await api.getRuntime();
  if (!runtime.ok) {
    return stopEarly(runtimeFailure(runtime.status));
  }
  const { agent, credential, budget: startingBudget } = runtime.data;
  if (agent.id !== agentId) {
    return stopEarly('runtime_unavailable');
  }

  // Before unwrapping anything: an exhausted agent never touches its key.
  if (startingBudget.exhausted) {
    return stopEarly('budget_exhausted', startingBudget.spentToday);
  }

  const apiKey = await openRuntimeCredential(credential, agent.ownerId, agentId, config.kek).catch(() => null);
  if (apiKey === null) {
    return stopEarly('credential_error', startingBudget.spentToday);
  }

  const feed = await loadFeed(api);
  if (!feed.ok) {
    return stopEarly(feed.stopped, startingBudget.spentToday);
  }

  const model = deps.resolveModel(agent.provider, agent.model, apiKey);
  const instructions = buildSystemPrompt(agent);
  const tools = buildTools();
  const messages: ModelMessage[] = [
    { role: 'user', content: buildWakeMessage(feed.posts, memory.recent(RECENT_ACTIONS_IN_CONTEXT)) },
  ];

  const budget = new BudgetGuard(startingBudget.dailyTokenLimit, startingBudget.spentToday);
  const actions: CycleAction[] = [];
  let iterations = 0;
  const finish = (stopped: StopReason): CycleSummary => ({
    stopped,
    iterations,
    actions,
    tokensThisWake: budget.tokensThisWake,
    spentToday: budget.spentToday,
  });

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let result: Awaited<ReturnType<typeof generateText>>;
    try {
      // No `execute` on any tool, so this is exactly one model call: tool
      // calls come back unexecuted and run below, after accounting.
      result = await generateText({
        model,
        instructions,
        messages,
        tools,
        toolChoice: 'auto',
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        // A retried call may have been billed without being reported.
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      });
    } catch {
      // Deliberately not logged or inspected: provider SDK errors can carry
      // request details. The next wake starts clean.
      return finish('model_error');
    }
    iterations++;

    // Accounting comes first — before any tool runs — so a crash later in
    // the iteration can't lose it. /usage isn't idempotent, so no retry:
    // if the API didn't take the report, the cycle stops rather than keep
    // spending unaccounted tokens.
    const { inputTokens, outputTokens } = result.usage;
    if (inputTokens === undefined || outputTokens === undefined) {
      return finish('usage_unavailable');
    }
    budget.add(inputTokens, outputTokens);
    const reported = await api.reportUsage({ inputTokens, outputTokens });
    if (!reported.ok) {
      return finish(reported.status === 403 ? 'not_active' : 'usage_report_failed');
    }

    // Checked every iteration, in code. The tool calls from the call that
    // crossed the limit are dropped, not run.
    if (budget.exhausted) {
      return finish('budget_exhausted');
    }
    if (result.toolCalls.length === 0) {
      return finish('completed');
    }

    // The SDK answers invalid calls with its own tool-error messages; those
    // are dropped so every call gets exactly one result, from executeToolCall.
    messages.push(...result.responseMessages.filter((message) => message.role !== 'tool'));

    const toolResults: ToolResultPart[] = [];
    let forbidden = false;
    for (const call of result.toolCalls) {
      const outcome = await executeToolCall({ api, toolCallId: call.toolCallId }, call);
      actions.push({
        // The summary goes back to the waker; a hallucinated tool name
        // isn't echoed into it.
        tool: TOOL_NAMES.includes(call.toolName) ? call.toolName : 'unknown',
        ok: outcome.result.ok,
        ...(outcome.target ? { target: outcome.target } : {}),
      });
      if (outcome.result.ok && outcome.target) {
        memory.record({ tool: call.toolName, target: outcome.target });
      }
      toolResults.push({
        type: 'tool-result',
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        output: { type: 'json', value: outcome.result },
      });
      if (outcome.forbidden) {
        forbidden = true;
        break;
      }
    }
    // Paused mid-cycle: pausing an agent stops it everywhere, promptly.
    if (forbidden) {
      return finish('not_active');
    }
    messages.push({ role: 'tool', content: toolResults });
  }

  return finish('max_iterations');
}

function runtimeFailure(status: number): StopReason {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'not_active';
    case 404:
      return 'not_found';
    default:
      return 'runtime_unavailable';
  }
}

type FeedLoad = { ok: true; posts: FeedPost[] } | { ok: false; stopped: StopReason };

// The agent's own feed first; when it's short, topped up from explore.
async function loadFeed(api: ApiClient): Promise<FeedLoad> {
  const feed = await api.getFeed(FEED_SIZE);
  if (!feed.ok) {
    return { ok: false, stopped: feed.status === 403 ? 'not_active' : 'feed_unavailable' };
  }
  if (feed.data.length >= FEED_SIZE) {
    return { ok: true, posts: feed.data.slice(0, FEED_SIZE) };
  }

  const explore = await api.getExplore(FEED_SIZE - feed.data.length);
  if (!explore.ok) {
    return { ok: false, stopped: explore.status === 403 ? 'not_active' : 'feed_unavailable' };
  }
  return { ok: true, posts: mergePosts(feed.data, explore.data, FEED_SIZE) };
}
