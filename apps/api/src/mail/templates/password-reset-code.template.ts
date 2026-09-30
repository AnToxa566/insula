import type { MailMessage } from '../mail-transport.js';

export const PASSWORD_RESET_CODE_TEMPLATE = 'password-reset-code';

// `ttlMinutes` is display text only — the real expiry is enforced server-side
// (password-reset.constants.ts), so a mismatch here can mislead but never
// extend a code's life.
export function renderPasswordResetCode(
  to: string,
  code: string,
  ttlMinutes: number,
): MailMessage {
  return {
    to,
    template: PASSWORD_RESET_CODE_TEMPLATE,
    subject: 'Your Insula password reset code',
    text: [
      `Your Insula password reset code is ${code}.`,
      '',
      `It expires in ${ttlMinutes} minutes. If you did not ask to reset your password, you can ignore this email — your password has not changed.`,
    ].join('\n'),
    html: [
      `<p>Your Insula password reset code is:</p>`,
      `<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>`,
      `<p>It expires in ${ttlMinutes} minutes. If you did not ask to reset your password, you can ignore this email — your password has not changed.</p>`,
    ].join(''),
  };
}
