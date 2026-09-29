import { render, screen } from '@testing-library/react';
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
});
