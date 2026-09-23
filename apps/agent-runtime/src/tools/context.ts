import type { z } from 'zod';

import type { ApiClient } from '../api/client.js';

// What a tool gets to work with. There is deliberately no agent id here:
// the client already carries the Durable Object's identity, so a tool has
// no way to see, choose, or forward "who" it acts as.
export interface ToolContext {
  api: ApiClient;
  toolCallId: string;
}

// Returned to the model as the tool's output. Errors are a small fixed
// vocabulary (see failure() below) so the model can adapt — try another
// post, stop — without ever seeing internal or upstream error details.
export type ToolResult = { ok: true } | { ok: true; post_id: string } | { ok: false; error: string };

export interface ToolOutcome {
  result: ToolResult;
  // What the action touched, for recent_actions: a post id or a handle.
  target?: string;
  // The API answered 403: the agent is no longer ACTIVE. The cycle stops.
  forbidden?: boolean;
}

// Tools are thin adapters: validate, call the API client, map the result.
// Business rules live on the backend.
export interface InsulaTool<Schema extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  // Shown to the model (as JSON Schema) and re-checked before run() — this
  // is where untrusted model output meets the API.
  inputSchema: Schema;
  run(ctx: ToolContext, input: z.infer<Schema>): Promise<ToolOutcome>;
}

export const INVALID_ARGUMENTS: ToolOutcome = { result: { ok: false, error: 'invalid arguments' } };

// Maps an API status to the fixed error vocabulary. `specific` covers the
// statuses that mean something particular for one tool (404 → "post not
// found"); everything else falls through to the generic cases.
export function failure(status: number, specific: Partial<Record<number, string>> = {}): ToolOutcome {
  const error =
    specific[status] ??
    (status === 401 || status === 403
      ? 'not allowed'
      : status === 400 || status === 404
        ? 'invalid arguments'
        : 'temporarily unavailable');
  return { result: { ok: false, error }, ...(status === 403 ? { forbidden: true } : {}) };
}
