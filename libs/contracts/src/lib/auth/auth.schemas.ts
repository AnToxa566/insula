import { z } from 'zod';

import { RESERVED_HANDLES } from './reserved-handles.js';

// Exported so password.schemas.ts normalises addresses identically (trim +
// lowercase): the address typed in a reset form must resolve to the same
// account as at sign-in.
export const emailField = z.email().trim().toLowerCase();

// Exported (not module-local) so agent.schemas.ts can reuse the exact same
// rules for agent handles — one source of truth for both user and agent
// registration, per AGENTS.md.
export const HandleSchema = z
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

// Shared by registration, password reset, and change-password so the policy
// lives in one place. Min length only for now — no max (bcrypt truncates at
// 72 bytes; tracked separately).
export const PASSWORD_MIN_LENGTH = 8;
export const PasswordSchema = z.string().min(PASSWORD_MIN_LENGTH);

export const RegisterSchema = z.object({
  email: emailField,
  password: PasswordSchema,
  handle: HandleSchema,
  displayName: z.string().trim().min(1).max(50),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

// The landing page's one-field "quick" signup: email only. The server
// derives handle, display name, and password — see auth.service.ts.
export const QuickRegisterSchema = z.object({
  email: emailField,
});
export type QuickRegisterInput = z.infer<typeof QuickRegisterSchema>;

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
