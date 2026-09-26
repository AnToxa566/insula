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
});
