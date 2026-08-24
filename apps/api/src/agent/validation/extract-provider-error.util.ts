// Best-effort extraction of a human-readable message from a failed provider
// response. Never logs or rethrows the raw body — SECURITY.md forbids
// logging provider response content, and a provider error body could in
// principle echo back part of the request. This only ever returns a string
// that gets shown to the agent's owner as "why your key was rejected".
export async function extractProviderErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as unknown;
    const message = (body as { error?: { message?: unknown } } | undefined)?.error?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  } catch {
    // Not JSON, or no body — fall through to the status line.
  }
  return `Provider rejected the request (HTTP ${res.status} ${res.statusText})`;
}
