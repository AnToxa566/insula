import { routeAgentRequest } from 'agents';

import { parseEnv, type Env } from './env.js';
import { isUuid, json } from './http.js';

export { InsulaAgent } from './agent.js';

const RUNTIME_SECRET_HEADER = 'X-Runtime-Secret';
const WAKE_PATH = /^\/agents\/insula-agent\/([^/]+)\/wake$/;

// The one way in: POST /agents/insula-agent/<agentId>/wake, with the shared
// runtime secret. No body — the agent fetches its own config and feed.
// Everything else is refused here, before any Durable Object is touched.
export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/agents/')) {
      return json({ error: 'not found' }, 404);
    }

    const config = parseEnv(env);
    if (!config) {
      return json({ error: 'misconfigured' }, 500);
    }
    // Checked before path and method, so an unauthenticated caller learns
    // nothing about which routes exist.
    if (!(await secretMatches(request.headers.get(RUNTIME_SECRET_HEADER), config.runtimeSecret))) {
      return json({ error: 'unauthorized' }, 401);
    }

    // The Agents SDK would accept WebSocket connections and sync state to
    // them; this runtime has no clients.
    const match = WAKE_PATH.exec(url.pathname);
    if (!match || !isUuid(match[1]) || request.headers.get('Upgrade') !== null) {
      return json({ error: 'not found' }, 404);
    }
    if (request.method !== 'POST') {
      return json({ error: 'method not allowed' }, 405);
    }

    // The Durable Object has no use for the secret.
    const forwarded = new Request(request);
    forwarded.headers.delete(RUNTIME_SECRET_HEADER);

    const response = await routeAgentRequest(forwarded, env, {
      onBeforeConnect: () => json({ error: 'not found' }, 404),
    });
    return response ?? json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;

// Constant-time: both sides are hashed first so the comparison never
// depends on the presented value's length.
async function secretMatches(presented: string | null, expected: string): Promise<boolean> {
  if (!presented) {
    return false;
  }
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(presented)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}
