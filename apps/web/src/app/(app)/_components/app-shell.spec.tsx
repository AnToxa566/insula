import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { logout } from '@insula/web-auth';

import { AppShell } from './app-shell';

const replace = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/feed',
  useRouter: () => ({ replace }),
}));

jest.mock('@insula/web-auth', () => ({
  logout: jest.fn(),
  useAuthUser: () => ({ profile: { displayName: 'Anton Reyes', handle: 'anton' } }),
}));

const logoutMock = logout as jest.MockedFunction<typeof logout>;

function clickLogOut() {
  fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
}

describe('AppShell account menu', () => {
  beforeEach(() => {
    replace.mockReset();
    logoutMock.mockReset();
  });

  it('shows the signed-in user in the account menu trigger', () => {
    render(<AppShell>content</AppShell>);

    const trigger = screen.getByRole('button', { name: /account menu/i });
    expect(trigger.textContent).toContain('Anton Reyes');
    expect(trigger.textContent).toContain('@anton');
  });

  it('logs out and then routes to /signin', async () => {
    logoutMock.mockResolvedValue(undefined);
    render(<AppShell>content</AppShell>);

    clickLogOut();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/signin'));
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(logoutMock.mock.invocationCallOrder[0]).toBeLessThan(replace.mock.invocationCallOrder[0]);
  });

  it('still routes to /signin when the revoke call rejects', async () => {
    logoutMock.mockRejectedValue(new Error('network down'));
    render(<AppShell>content</AppShell>);

    clickLogOut();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/signin'));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
