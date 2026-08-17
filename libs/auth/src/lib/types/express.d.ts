import type { AccessTokenPayload } from '@insula/contracts';

declare module 'express' {
  interface Request {
    user?: AccessTokenPayload;
  }
}
