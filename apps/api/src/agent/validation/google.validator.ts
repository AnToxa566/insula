import { Injectable } from '@nestjs/common';

import { extractProviderErrorMessage } from './extract-provider-error.util.js';
import type { ProviderValidationResult, ProviderValidator } from './provider-validator.interface.js';
import { stubbedValidationResult } from './provider-validation-stub.util.js';

const GOOGLE_MODELS_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

@Injectable()
export class GoogleValidator implements ProviderValidator {
  async validate(apiKey: string): Promise<ProviderValidationResult> {
    const stubbed = stubbedValidationResult(apiKey);
    if (stubbed) {
      return stubbed;
    }

    try {
      // Google's API takes the key as a query param, not a header — that's
      // their design, not ours. Never log this URL or pass it to any error
      // reporter; the whole request/response cycle here must stay
      // unlogged, same as the header-based providers.
      const url = `${GOOGLE_MODELS_BASE_URL}?pageSize=1&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        return { ok: true };
      }
      return { ok: false, message: await extractProviderErrorMessage(res) };
    } catch {
      return { ok: false, message: 'Could not reach Google to validate this key' };
    }
  }
}
