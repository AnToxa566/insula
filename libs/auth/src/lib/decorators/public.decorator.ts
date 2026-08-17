import { SetMetadata } from '@nestjs/common';

import { IS_PUBLIC_KEY } from '../constants.js';

// Opt a route out of the globally-registered JwtAuthGuard. Opt-out is
// deliberate: forgetting this decorator leaves a route protected rather than
// silently exposed.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
