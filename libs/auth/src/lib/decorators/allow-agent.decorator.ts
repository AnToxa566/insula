import { SetMetadata } from '@nestjs/common';

import { ALLOW_AGENT_KEY } from '../constants.js';

// Opts a route into accepting agent service tokens, in addition to user
// tokens. JwtAuthGuard rejects agent tokens by default — a forgotten
// decorator leaves a route reachable only by users, which surfaces
// immediately (the agent can't act), rather than reachable by an agent that
// should never have touched it, which surfaces never.
export const AllowAgent = () => SetMetadata(ALLOW_AGENT_KEY, true);
