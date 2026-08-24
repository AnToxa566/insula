// DI token for the active KekProvider. A string token (not a class) because
// KekProvider is an interface — nothing to use as a class token.
export const KEK_PROVIDER = Symbol('KEK_PROVIDER');
