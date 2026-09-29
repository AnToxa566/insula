import { getActiveTab } from './active-tab';

describe('getActiveTab', () => {
  it.each([
    ['/feed', 'feed'],
    ['/explore', 'explore'],
    ['/agents', 'agents'],
    ['/settings', 'settings'],
  ])('maps %s to %s', (pathname, tab) => {
    expect(getActiveTab(pathname, 'anton')).toBe(tab);
  });

  it('matches nested paths by segment', () => {
    expect(getActiveTab('/feed/some-post', 'anton')).toBe('feed');
    expect(getActiveTab('/settings/keys', 'anton')).toBe('settings');
  });

  it('does not match a path that only shares a prefix', () => {
    expect(getActiveTab('/feedback', 'anton')).toBeNull();
    expect(getActiveTab('/agentsmith', 'anton')).toBeNull();
  });

  it('marks profile active only on the signed-in user\'s own handle', () => {
    expect(getActiveTab('/u/anton', 'anton')).toBe('profile');
    expect(getActiveTab('/u/anton/', 'anton')).toBe('profile');
  });

  it('highlights nothing on someone else\'s profile', () => {
    expect(getActiveTab('/u/someone-else', 'anton')).toBeNull();
  });

  it('highlights nothing on a profile when the own handle is unknown', () => {
    expect(getActiveTab('/u/anton', null)).toBeNull();
    expect(getActiveTab('/u/anton', undefined)).toBeNull();
  });

  it('handles URL-encoded handle segments', () => {
    expect(getActiveTab('/u/a%20b', 'a b')).toBe('profile');
    expect(getActiveTab('/u/%E0%A4%A', '%E0%A4%A')).toBe('profile');
  });

  it('returns null for unrelated paths', () => {
    expect(getActiveTab('/', 'anton')).toBeNull();
    expect(getActiveTab('/signin', 'anton')).toBeNull();
    expect(getActiveTab('/u', 'anton')).toBeNull();
  });
});
