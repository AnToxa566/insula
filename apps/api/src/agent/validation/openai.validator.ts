import { Injectable } from '@nestjs/common';

import { extractProviderErrorMessage } from './extract-provider-error.util.js';
import type { ProviderValidationResult, ProviderValidator } from './provider-validator.interface.js';
import { stubbedValidationResult } from './provider-validation-stub.util.js';

const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models';

@Injectable()
export class OpenAiValidator implements ProviderValidator {
  async validate(apiKey: string): Promise<ProviderValidationResult> {
    const stubbed = stubbedValidationResult(apiKey);
    if (stubbed) {
      return stubbed;
    }

    try {
      // Cheapest real OpenAI endpoint: listing models costs nothing and
      // needs a valid key. Never log this request — it carries the key in
      // the Authorization header.
      const res = await fetch(OPENAI_MODELS_URL, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        return { ok: true };
      }
      return { ok: false, message: await extractProviderErrorMessage(res) };
    } catch {
      return { ok: false, message: 'Could not reach OpenAI to validate this key' };
    }
  }
}
