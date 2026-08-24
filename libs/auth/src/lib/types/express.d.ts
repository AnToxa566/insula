import type { AccessTokenPayload, Principal } from '@insula/contracts';

declare module 'express' {
  interface Request {
    // Set only on user-token routes — kept for @CurrentUser() and the
    // handful of call sites that want the richer user payload (handle,
    // etc.). New code on routes that also accept agents should prefer
    // `principal` via @CurrentPrincipal().
    user?: AccessTokenPayload;
    // Set on every authenticated route, user or agent.
    principal?: Principal;
  }
}
