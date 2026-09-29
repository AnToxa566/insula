import { render, screen } from '@testing-library/react';
import type { ComponentPropsWithoutRef } from 'react';

import { TabBar } from './tab-bar';

describe('TabBar', () => {
  it('renders all five items', () => {
    render(<TabBar active="feed" />);

    ['Feed', 'Explore', 'Agents', 'Profile', 'Settings'].forEach((label) => {
      expect(screen.getByText(label)).toBeTruthy();
    });
  });

  it('marks the active tab with aria-current', () => {
    render(<TabBar active="explore" />);

    const activeLink = screen.getByRole('link', { name: /Explore/ });
    expect(activeLink.getAttribute('aria-current')).toBe('page');

    const inactiveLink = screen.getByRole('link', { name: /Feed/ });
    expect(inactiveLink.getAttribute('aria-current')).toBeNull();
  });

  it('defaults every href to "#" when none are given', () => {
    render(<TabBar active="feed" />);

    expect(screen.getByRole('link', { name: /Agents/ }).getAttribute('href')).toBe('#');
  });

  it('uses a provided href for a tab', () => {
    render(<TabBar active="feed" hrefs={{ profile: '/profile' }} />);

    expect(screen.getByRole('link', { name: /Profile/ }).getAttribute('href')).toBe('/profile');
  });

  it('marks no tab active when active is null or omitted', () => {
    const { unmount } = render(<TabBar active={null} />);
    expect(document.querySelector('[aria-current]')).toBeNull();
    unmount();

    render(<TabBar />);
    expect(document.querySelector('[aria-current]')).toBeNull();
  });

  it('is labelled as the primary navigation', () => {
    render(<TabBar active="feed" />);

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
  });

  it('renders tabs through linkAs when given', () => {
    const CustomLink = ({ children, ...props }: ComponentPropsWithoutRef<'a'>) => (
      <a data-custom-link="" {...props}>
        {children}
      </a>
    );
    render(<TabBar active="feed" linkAs={CustomLink} />);

    expect(document.querySelectorAll('[data-custom-link]').length).toBe(5);
  });
});
