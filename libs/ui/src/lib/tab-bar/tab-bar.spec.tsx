import { render, screen } from '@testing-library/react';

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
});
