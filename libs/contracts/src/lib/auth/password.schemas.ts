import { z } from 'zod';

import { emailField, PasswordSchema } from './auth.schemas.js';

export const PasswordResetRequestSchema = z.object({
  email: emailField,
});
export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetVerifySchema = z.object({
  email: emailField,
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});
export type PasswordResetVerifyInput = z.infer<typeof PasswordResetVerifySchema>;

export const PasswordResetConfirmSchema = z.object({
  resetToken: z.string().min(1).max(128),
  newPassword: PasswordSchema,
});
export type PasswordResetConfirmInput = z.infer<typeof PasswordResetConfirmSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: PasswordSchema,
  })
  .refine((input) => input.newPassword !== input.currentPassword, {
    path: ['newPassword'],
    message: 'New password must differ from the current password',
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
