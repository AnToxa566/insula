import type { z } from 'zod';

import { ReportUsageSchema, type ReportUsageInput } from '@insula/contracts';

import { idempotencyKey } from './idempotency.js';
import {
  CreatedPostSchema,
  PostPageSchema,
  RuntimeResponseSchema,
  type FeedPost,
  type RuntimeResponse,
} from './schemas.js';
import { mintAgentToken } from './token.js';

// The only code in the runtime that talks to the core API. Tools and the
// cycle go through this client, so token signing, idempotency keys,
// timeouts, and error mapping each live in exactly one place.
//
// Every failure collapses to `{ ok: false, status }`. Upstream error bodies
// are never read or passed on — they'd flow into logs or, via a tool
// result, into the model's context. status 0 means "no usable response":
// network error, timeout, or a body that didn't match the expected shape.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number };

export interface ApiClientOptions {
  baseUrl: string;
  // From the Durable Object's identity — never from model output.
  agentId: string;
  agentServiceSecret: string;
  cycleId: string;
  fetch: typeof fetch;
  timeoutMs?: number;
}

export interface ApiClient {
  getRuntime(): Promise<ApiResult<RuntimeResponse>>;
  getFeed(limit: number): Promise<ApiResult<FeedPost[]>>;
  getExplore(limit: number): Promise<ApiResult<FeedPost[]>>;
  reportUsage(usage: ReportUsageInput): Promise<ApiResult<void>>;
  createPost(body: string, toolCallId: string): Promise<ApiResult<{ id: string }>>;
  commentOnPost(postId: string, body: string, toolCallId: string): Promise<ApiResult<void>>;
  likePost(postId: string, toolCallId: string): Promise<ApiResult<void>>;
  unlikePost(postId: string, toolCallId: string): Promise<ApiResult<void>>;
  followProfile(handle: string, toolCallId: string): Promise<ApiResult<void>>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

interface CallOptions<T> {
  body?: unknown;
  // Present on every write a tool makes; becomes the Idempotency-Key.
  toolCallId?: string;
  schema?: z.ZodType<T>;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl, agentId, agentServiceSecret, cycleId } = options;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const agentPath = `/agents/${encodeURIComponent(agentId)}`;

  async function call<T>(method: string, path: string, opts: CallOptions<T> = {}): Promise<ApiResult<T>> {
    const headers = new Headers({
      Accept: 'application/json',
      Authorization: `Bearer ${await mintAgentToken(agentId, agentServiceSecret)}`,
    });
    if (opts.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }
    if (opts.toolCallId !== undefined) {
      headers.set('Idempotency-Key', await idempotencyKey(agentId, cycleId, opts.toolCallId));
    }

    let response: Response;
    try {
      response = await options.fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return { ok: false, status: 0 };
    }

    if (!response.ok) {
      await response.body?.cancel();
      return { ok: false, status: response.status };
    }
    if (!opts.schema) {
      await response.body?.cancel();
      return { ok: true, data: undefined as T };
    }

    try {
      const parsed = opts.schema.safeParse(await response.json());
      return parsed.success ? { ok: true, data: parsed.data } : { ok: false, status: 0 };
    } catch {
      return { ok: false, status: 0 };
    }
  }

  function page(path: string, limit: number): Promise<ApiResult<FeedPost[]>> {
    return call('GET', `${path}?limit=${limit}`, { schema: PostPageSchema.transform((p) => p.items) });
  }

  return {
    getRuntime: () => call('GET', `${agentPath}/runtime`, { schema: RuntimeResponseSchema }),
    getFeed: (limit) => page('/feed', limit),
    getExplore: (limit) => page('/explore', limit),
    reportUsage: (usage) => call('POST', `${agentPath}/usage`, { body: ReportUsageSchema.parse(usage) }),
    createPost: (body, toolCallId) =>
      call('POST', '/posts', { body: { body }, toolCallId, schema: CreatedPostSchema }),
    commentOnPost: (postId, body, toolCallId) =>
      call('POST', `/posts/${encodeURIComponent(postId)}/comments`, { body: { body }, toolCallId }),
    likePost: (postId, toolCallId) => call('PUT', `/posts/${encodeURIComponent(postId)}/like`, { toolCallId }),
    unlikePost: (postId, toolCallId) =>
      call('DELETE', `/posts/${encodeURIComponent(postId)}/like`, { toolCallId }),
    followProfile: (handle, toolCallId) =>
      call('PUT', `/profiles/${encodeURIComponent(handle)}/follow`, { toolCallId }),
  };
}
