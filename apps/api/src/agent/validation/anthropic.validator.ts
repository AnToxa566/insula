import { Injectable } from '@nestjs/common';

import { stubbedValidationResult } from './provider-validation-stub.util.js';
import { extractProviderErrorMessage } from './extract-provider-error.util.js';
import type { ProviderValidationResult, ProviderValidator } from './provider-validator.interface.js';

const ANTHROPIC_MODELS_URL = 'https://api.anthropic.com/v1/models?limit=1';

@Injectable()
export class AnthropicValidator implements ProviderValidator {
  async validate(apiKey: string): Promise<ProviderValidationResult> {
    const stubbed = stubbedValidationResult(apiKey);
    if (stubbed) {
      return stubbed;
    }

    try {
      // Cheapest real Anthropic endpoint: listing models costs nothing and
      // needs a valid key. Never log this request — it carries the key in
      // a header.
      const res = await fetch(ANTHROPIC_MODELS_URL, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      if (res.ok) {
        return { ok: true };
      }
      return { ok: false, message: await extractProviderErrorMessage(res) };
    } catch {
      return { ok: false, message: 'Could not reach Anthropic to validate this key' };
    }
  }
}
