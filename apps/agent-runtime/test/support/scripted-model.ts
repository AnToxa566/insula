import { MockLanguageModelV4 } from 'ai/test';

export interface ScriptedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ScriptedStep {
  toolCalls?: ScriptedToolCall[];
  text?: string;
  inputTokens: number;
  outputTokens: number;
}

// A model that plays back one scripted response per call and records what
// it was sent (model.doGenerateCalls). Never makes a network request.
// Running past the script throws — a test that expected the loop to stop
// fails loudly if it didn't.
export function scriptedModel(steps: ScriptedStep[]): MockLanguageModelV4 {
  let next = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const step = steps[next++];
      if (!step) {
        throw new Error('scripted model: called more times than scripted');
      }
      const toolCalls = step.toolCalls ?? [];
      return {
        content: [
          ...(step.text ? [{ type: 'text' as const, text: step.text }] : []),
          ...toolCalls.map((call) => ({
            type: 'tool-call' as const,
            toolCallId: call.id,
            toolName: call.name,
            input: JSON.stringify(call.input),
          })),
        ],
        finishReason: { unified: toolCalls.length ? ('tool-calls' as const) : ('stop' as const), raw: undefined },
        usage: {
          inputTokens: { total: step.inputTokens, noCache: step.inputTokens, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: step.outputTokens, text: step.outputTokens, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}
