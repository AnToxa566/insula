import { render, screen } from '@testing-library/react';

import { Avatar } from './avatar';

describe('Avatar', () => {
  it('renders the initial', () => {
    render(<Avatar variant="human" initial="M" />);

    expect(screen.getByText('M')).toBeTruthy();
  });

  it('applies a circular shape for the human variant', () => {
    render(<Avatar variant="human" initial="M" />);

    expect(screen.getByText('M').className).toContain('rounded-full');
  });

  it('applies the agent rounded-square shape and plum ring', () => {
    render(<Avatar variant="agent" initial="T" />);

    const el = screen.getByText('T');
    expect(el.className).toContain('border-agent');
    expect(el.className).toContain('border-plum');
  });

  it('sets the light tone as a CSS custom property, not a plain inline background', () => {
    render(<Avatar variant="human" initial="J" tone="#DCE3DA" />);

    const el = screen.getByText('J') as HTMLElement;
    expect(el.className).toContain('avatar-tone');
    expect(el.style.getPropertyValue('--avatar-tone-light')).toBe('#DCE3DA');
  });

  it('does not set --avatar-tone-dark when toneDark is omitted, so the CSS fallback (neutral avatar token) applies in dark mode instead of the light tone', () => {
    render(<Avatar variant="human" initial="J" tone="#DCE3DA" />);

    expect((screen.getByText('J') as HTMLElement).style.getPropertyValue('--avatar-tone-dark')).toBe('');
  });

  it('carries a distinct dark-mode tone when toneDark is given', () => {
    render(<Avatar variant="human" initial="J" tone="#DCE3DA" toneDark="#2E362D" />);

    expect((screen.getByText('J') as HTMLElement).style.getPropertyValue('--avatar-tone-dark')).toBe('#2E362D');
  });

  it('uses the toned dark text only when a dark tone is actually given', () => {
    render(<Avatar variant="human" initial="J" tone="#DCE3DA" toneDark="#2E362D" />);
    expect(screen.getByText('J').className).toContain('dark:text-[#E4E2DD]');
  });

  it('falls back to the neutral dark text and avatar-tone class when tone has no toneDark', () => {
    render(<Avatar variant="human" initial="J" tone="#DCE3DA" />);

    const el = screen.getByText('J');
    expect(el.className).toContain('dark:text-[#D6D4DE]');
    expect(el.className).toContain('avatar-tone');
  });

  it('uses the neutral bg-avatar token and its dark text when no tone is given at all', () => {
    render(<Avatar variant="human" initial="J" />);

    const el = screen.getByText('J');
    expect(el.className).toContain('dark:text-[#D6D4DE]');
    expect(el.className).toContain('bg-avatar');
    expect(el.className).not.toContain('avatar-tone');
  });

  it('ignores tone for the agent variant', () => {
    render(<Avatar variant="agent" initial="T" tone="#DCE3DA" />);

    const el = screen.getByText('T') as HTMLElement;
    expect(el.className).toContain('bg-plum-tint');
    expect(el.className).not.toContain('avatar-tone');
  });

  it('scales size classes for sm/md/lg', () => {
    const { rerender } = render(<Avatar variant="human" initial="M" size="sm" />);
    expect(screen.getByText('M').className).toContain('w-8');

    rerender(<Avatar variant="human" initial="M" size="lg" />);
    expect(screen.getByText('M').className).toContain('w-20');
  });
});
