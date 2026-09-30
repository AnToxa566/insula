import type { MailMessage } from '../mail-transport.js';

export const PASSWORD_CHANGED_TEMPLATE = 'password-changed';

export function renderPasswordChanged(to: string): MailMessage {
  return {
    to,
    template: PASSWORD_CHANGED_TEMPLATE,
    subject: 'Your Insula password was changed',
    text: [
      'The password for your Insula account was just changed, and you were signed out everywhere else.',
      '',
      'If this was you, there is nothing to do. If it was not, reset your password straight away.',
    ].join('\n'),
    html: [
      `<p>The password for your Insula account was just changed, and you were signed out everywhere else.</p>`,
      `<p>If this was you, there is nothing to do. If it was not, reset your password straight away.</p>`,
    ].join(''),
  };
}
