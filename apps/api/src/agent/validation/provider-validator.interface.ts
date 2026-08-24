export interface ProviderValidationResult {
  ok: boolean;
  // Only set when ok is false. This is the provider's own rejection
  // message (e.g. "invalid x-api-key") — never anything derived from the
  // key itself, and the key is never included here.
  message?: string;
}

// One implementation per LlmProvider, selected by ProviderValidatorFactory.
// validate() must never throw for an ordinary rejection (wrong key, expired
// key, etc.) — that's `{ ok: false, message }`. Throwing is reserved for
// something unexpected (network failure, malformed provider response).
export interface ProviderValidator {
  validate(apiKey: string): Promise<ProviderValidationResult>;
}
