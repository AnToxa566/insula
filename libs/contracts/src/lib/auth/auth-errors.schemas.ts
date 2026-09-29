import { z } from 'zod';

// Shape of the 409 body POST /auth/register returns when the email or
// handle is already taken. `field` lets the client attach the message to
// the right input instead of a generic toast.
export const RegisterConflictErrorSchema = z.object({
  statusCode: z.literal(409),
  error: z.literal('Conflict'),
  field: z.enum(['email', 'handle']),
  message: z.string(),
});
export type RegisterConflictError = z.infer<typeof RegisterConflictErrorSchema>;
