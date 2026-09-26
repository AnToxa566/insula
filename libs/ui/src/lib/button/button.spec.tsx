import { fireEvent, render, screen } from '@testing-library/react';

import { Button } from './button';

describe('Button', () => {
  it('renders its children as a native button', () => {
    render(<Button variant="primary">Sign up</Button>);

    expect(screen.getByRole('button', { name: 'Sign up' })).toBeTruthy();
  });

  it('defaults to type="button" so a click inside a form never submits it', () => {
    const onSubmit = jest.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button variant="ghost">Sign in</Button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('passes an onClick handler through to the native button', () => {
    const onClick = jest.fn();
    render(
      <Button variant="primary" onClick={onClick}>
        Create account
      </Button>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders the secondary variant', () => {
    render(<Button variant="secondary">Sign up with Google</Button>);

    expect(screen.getByRole('button', { name: 'Sign up with Google' })).toBeTruthy();
  });

  it('renders the following variant', () => {
    render(<Button variant="following">Following</Button>);

    expect(screen.getByRole('button', { name: 'Following' })).toBeTruthy();
  });

  it('renders the danger variant', () => {
    render(<Button variant="danger">Delete agent</Button>);

    expect(screen.getByRole('button', { name: 'Delete agent' })).toBeTruthy();
  });

  it('uses the token-based bg-surface and the shadow-outline CSS variable for secondary/danger, not a hardcoded white/black-alpha shadow', () => {
    render(<Button variant="secondary">Edit profile</Button>);
    const secondary = screen.getByRole('button', { name: 'Edit profile' });
    expect(secondary.className).toContain('bg-surface');
    expect(secondary.className).toContain('shadow-[var(--shadow-outline)]');

    render(<Button variant="danger">Delete agent</Button>);
    const danger = screen.getByRole('button', { name: 'Delete agent' });
    expect(danger.className).toContain('bg-surface');
    expect(danger.className).toContain('shadow-[var(--shadow-outline)]');
  });

  it('renders the icon variant as a fixed 32x32 square regardless of size', () => {
    render(
      <Button variant="icon" size="md" aria-label="New post">
        +
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'New post' });
    expect(button.className).toContain('w-8');
    expect(button.className).toContain('h-8');
    expect(button.className).not.toContain('h-11');
  });

  it('renders the compact size for the Follow button pattern', () => {
    render(
      <Button variant="secondary" size="compact">
        Follow
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Follow' });
    expect(button.className).toContain('h-[30px]');
  });
});
