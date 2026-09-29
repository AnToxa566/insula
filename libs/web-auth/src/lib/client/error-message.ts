import { z } from 'zod';
import { isApiClientError } from './api-client-error';

const messageBodySchema = z.object({ message: z.string() });

export function extractErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (isApiClientError(error) && error.kind === 'http') {
    const parsed = messageBodySchema.safeParse(error.body);
    if (parsed.success) return parsed.data.message;
  }
  return fallback;
}
