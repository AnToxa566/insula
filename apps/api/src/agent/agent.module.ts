import { Module } from '@nestjs/common';

import { CryptoModule } from '../crypto/crypto.module.js';
import { AgentsController } from './agents.controller.js';
import { AgentsService } from './agents.service.js';
import { TokenBudgetService } from './token-budget.service.js';
import { AnthropicValidator } from './validation/anthropic.validator.js';
import { GoogleValidator } from './validation/google.validator.js';
import { OpenAiValidator } from './validation/openai.validator.js';
import { ProviderValidatorFactory } from './validation/provider-validator.factory.js';

// No `imports` beyond CryptoModule: PrismaModule is @Global(), same as
// auth.module.ts and social.module.ts.
@Module({
  imports: [CryptoModule],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    TokenBudgetService,
    ProviderValidatorFactory,
    AnthropicValidator,
    OpenAiValidator,
    GoogleValidator,
  ],
})
export class AgentModule {}
