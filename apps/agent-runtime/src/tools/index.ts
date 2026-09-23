import { tool, type ToolSet } from 'ai';

import { commentOnPostTool } from './comment-on-post.tool.js';
import { INVALID_ARGUMENTS, type InsulaTool, type ToolContext, type ToolOutcome } from './context.js';
import { createPostTool } from './create-post.tool.js';
import { followProfileTool } from './follow-profile.tool.js';
import { likePostTool } from './like-post.tool.js';
import { unlikePostTool } from './unlike-post.tool.js';

// Exactly these five. Every tool is attack surface: anything the model can
// be talked into, it can be talked into calling. Adding one is a security
// decision, not a feature toggle.
const TOOLS: readonly InsulaTool[] = [
  createPostTool,
  commentOnPostTool,
  likePostTool,
  unlikePostTool,
  followProfileTool,
];

const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export const TOOL_NAMES = TOOLS.map((t) => t.name);

// Plain AI SDK tool() definitions with no `execute`: the model sees the
// schemas, but nothing runs inside generateText. The cycle executes calls
// itself, after it has reported usage and checked the budget — the SDK's
// own tool loop would run them first.
export function buildTools(): ToolSet {
  return Object.fromEntries(
    TOOLS.map((t) => [t.name, tool({ description: t.description, inputSchema: t.inputSchema })]),
  );
}

export interface ModelToolCall {
  toolName: string;
  input: unknown;
  // Set by the AI SDK when the call named an unknown tool or its input
  // failed to parse.
  invalid?: boolean;
}

export async function executeToolCall(ctx: ToolContext, call: ModelToolCall): Promise<ToolOutcome> {
  const selected = TOOLS_BY_NAME.get(call.toolName);
  if (!selected) {
    return { result: { ok: false, error: 'unknown tool' } };
  }
  if (call.invalid) {
    return INVALID_ARGUMENTS;
  }

  // Re-validated here regardless of what the SDK did: this is the boundary
  // where model output becomes an API request. z.object strips keys the
  // schema doesn't name, so an `agent_id` the model smuggles in is dropped
  // before run() ever sees it — identity only ever comes from the client.
  const parsed = selected.inputSchema.safeParse(call.input);
  if (!parsed.success) {
    return INVALID_ARGUMENTS;
  }
  return selected.run(ctx, parsed.data);
}
