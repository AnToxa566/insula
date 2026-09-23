// Swagger header spec for routes wrapped with IdempotencyInterceptor.
// Shared so the description can't drift between controllers.
export const IDEMPOTENCY_KEY_HEADER = {
  name: 'Idempotency-Key',
  required: false,
  description: 'Opaque caller-supplied key. A repeat call with the same key replays the first response.',
};
