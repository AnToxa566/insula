import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentPropsWithoutRef } from 'react';

import { SideNav } from './side-nav';

describe('SideNav', () => {
  it('renders all five items, labelling agents "My agents"', () => {
    render(<SideNav active="feed" />);

    ['Feed', 'Explore', 'My agents', 'Profile', 'Settings'].forEach((label) => {
      expect(screen.getByText(label)).toBeTruthy();
    });
  });

  it('is labelled as the primary navigation', () => {
    render(<SideNav active="feed" />);

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
  });

  it('marks the active item with aria-current', () => {
    render(<SideNav active="explore" />);

    expect(screen.getByRole('link', { name: /Explore/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /Feed/ }).getAttribute('aria-current')).toBeNull();
  });

  it('marks nothing active when active is null or omitted', () => {
    const { unmount } = render(<SideNav active={null} />);
    expect(document.querySelector('[aria-current]')).toBeNull();
    unmount();

    render(<SideNav />);
    expect(document.querySelector('[aria-current]')).toBeNull();
  });

  it('defaults every href to "#" and uses a provided href', () => {
    render(<SideNav active="feed" hrefs={{ profile: '/u/anton' }} />);

    expect(screen.getByRole('link', { name: /Explore/ }).getAttribute('href')).toBe('#');
    expect(screen.getByRole('link', { name: /Profile/ }).getAttribute('href')).toBe('/u/anton');
  });

  it('renders items through linkAs when given', () => {
    const CustomLink = ({ children, ...props }: ComponentPropsWithoutRef<'a'>) => (
      <a data-custom-link="" {...props}>
        {children}
      </a>
    );
    render(<SideNav active="feed" linkAs={CustomLink} />);

    expect(document.querySelectorAll('[data-custom-link]').length).toBe(5);
  });

  it('shows the user name, handle and initial in the footer', () => {
    render(<SideNav active="feed" user={{ name: 'Anton Reyes', handle: 'anton' }} />);

    expect(screen.getByText('Anton Reyes')).toBeTruthy();
    expect(screen.getByText('@anton')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('omits the footer when no user is given', () => {
    render(<SideNav active="feed" />);

    expect(screen.queryByText(/^@/)).toBeNull();
  });

  describe('account menu', () => {
    const user = { name: 'Anton Reyes', handle: 'anton' };

    it('has no menu trigger without onLogout', () => {
      render(<SideNav active="feed" user={user} />);

      expect(screen.queryByRole('button', { name: /account menu/i })).toBeNull();
    });

    it('has no menu trigger without a user', () => {
      render(<SideNav active="feed" onLogout={jest.fn()} />);

      expect(screen.queryByRole('button', { name: /account menu/i })).toBeNull();
    });

    it('shows the name and handle in the trigger', () => {
      render(<SideNav active="feed" user={user} onLogout={jest.fn()} />);

      const trigger = screen.getByRole('button', { name: /account menu/i });
      expect(trigger.textContent).toContain('Anton Reyes');
      expect(trigger.textContent).toContain('@anton');
    });

    it('reveals "Log out" on click', () => {
      render(<SideNav active="feed" user={user} onLogout={jest.fn()} />);
      expect(screen.queryByRole('menuitem', { name: 'Log out' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /account menu/i }));

      expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeTruthy();
    });

    it('calls onLogout when "Log out" is selected', () => {
      const onLogout = jest.fn();
      render(<SideNav active="feed" user={user} onLogout={onLogout} />);

      fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

      expect(onLogout).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });
});
