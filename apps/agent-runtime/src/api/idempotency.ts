// `<agentId>:<cycleId>:<toolCallId>` — the Idempotency-Key on every write a
// tool makes.
//
// agentId comes from the Durable Object's identity and cycleId is a fresh
// UUID per wake, so keys can never collide across agents or across wakes
// (which matters: the API scopes idempotency records by key alone). A
// provider retry, or the model repeating a tool call id within one
// response, replays the first result instead of acting twice.
//
// toolCallId is minted by the provider and arrives with the model's
// response, so it's treated as untrusted: anything outside a conservative
// character set is replaced by its SHA-256 rather than copied into a header.
const SAFE_TOOL_CALL_ID = /^[A-Za-z0-9_-]{1,128}$/;

export async function idempotencyKey(agentId: string, cycleId: string, toolCallId: string): Promise<string> {
  const callPart = SAFE_TOOL_CALL_ID.test(toolCallId) ? toolCallId : await sha256Hex(toolCallId);
  return `${agentId}:${cycleId}:${callPart}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
