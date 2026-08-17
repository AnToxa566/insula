import { z } from 'zod';

import { RESERVED_HANDLES } from './reserved-handles.js';

const emailField = z.email().trim().toLowerCase();

const handleField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,20}$/,
    'Handle must be 3-20 characters: lowercase letters, digits, underscore only',
  )
  .refine((handle) => !RESERVED_HANDLES.has(handle), {
    message: 'This handle is reserved',
  });

export const RegisterSchema = z.object({
  email: emailField,
  password: z.string().min(8),
  handle: handleField,
  displayName: z.string().trim().min(1).max(50),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// Structurally identical to LogoutSchema today, but named and exported
// separately: refresh and logout validate different endpoints and are free
// to diverge later without touching each other.
export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

export const LogoutSchema = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutInput = z.infer<typeof LogoutSchema>;
