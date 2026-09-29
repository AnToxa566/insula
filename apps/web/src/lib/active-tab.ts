import type { TabId } from '@insula/ui';

import { AppRoute } from './routes';

const SECTION_TABS: [AppRoute, TabId][] = [
  [AppRoute.Feed, 'feed'],
  [AppRoute.Explore, 'explore'],
  [AppRoute.Agents, 'agents'],
  [AppRoute.Settings, 'settings'],
];

function isWithin(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// Which nav item to highlight for a pathname. Sections match by whole path
// segment (`/feed/x` counts, `/feedback` does not). `/u/[handle]` highlights
// Profile only for the signed-in user's own handle — someone else's profile
// highlights nothing.
export function getActiveTab(pathname: string, ownHandle: string | null | undefined): TabId | null {
  for (const [route, tab] of SECTION_TABS) {
    if (isWithin(pathname, route)) return tab;
  }

  const [root, handleSegment] = pathname.split('/').filter(Boolean);
  if (root === 'u' && handleSegment && ownHandle && safeDecode(handleSegment) === ownHandle) {
    return 'profile';
  }

  return null;
}
