import { Injectable } from '@nestjs/common';

import type { LlmProvider } from '@insula/contracts';

import { AnthropicValidator } from './anthropic.validator.js';
import { GoogleValidator } from './google.validator.js';
import { OpenAiValidator } from './openai.validator.js';
import type { ProviderValidator } from './provider-validator.interface.js';

@Injectable()
export class ProviderValidatorFactory {
  constructor(
    private readonly anthropic: AnthropicValidator,
    private readonly openai: OpenAiValidator,
    private readonly google: GoogleValidator,
  ) {}

  get(provider: LlmProvider): ProviderValidator {
    switch (provider) {
      case 'ANTHROPIC':
        return this.anthropic;
      case 'OPENAI':
        return this.openai;
      case 'GOOGLE':
        return this.google;
      default: {
        const exhaustive: never = provider;
        throw new Error(`Unsupported provider: ${exhaustive}`);
      }
    }
  }
}
