import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

import type { LlmProvider } from '@insula/contracts';

// One tool-calling loop for all three providers; which one is picked per
// agent, at runtime, from its config.
//
// `apiKey` is the decrypted user key. The returned model closes over it, so
// the model is exactly as sensitive as the key: callers hold it in a local
// variable for one cycle and never store it anywhere.
export function resolveModel(provider: LlmProvider, model: string, apiKey: string): LanguageModel {
  switch (provider) {
    case 'ANTHROPIC':
      return createAnthropic({ apiKey })(model);
    case 'OPENAI':
      return createOpenAI({ apiKey })(model);
    case 'GOOGLE':
      return createGoogleGenerativeAI({ apiKey })(model);
    default: {
      const unsupported: never = provider;
      throw new Error(`Unsupported provider: ${String(unsupported)}`);
    }
  }
}
