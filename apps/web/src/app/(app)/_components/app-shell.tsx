'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SideNav, TabBar } from '@insula/ui';
import { useAuthUser } from '@insula/web-auth';

import { getActiveTab } from '../../../lib/active-tab';
import { AppRoute, profileHref } from '../../../lib/routes';

// Authorized shell from design/Nav.dc.html + TabBar.dc.html. From `lg` (1024)
// up: 200px sidebar beside a white rounded "sheet" on the canvas, capped at
// 880/920 by `BPS.inner` at 1360/1920. Below `lg`: the sheet goes full-bleed
// and the sidebar is replaced by the bottom tab bar. Both navs are always in
// the DOM and toggled with CSS on wrapper divs — no JS media query, so no
// hydration mismatch. The sheet scrolls internally so the navs stay fixed.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthUser();

  // Only the display fields — never email or anything else off the session.
  const handle = user?.profile.handle;
  const active = getActiveTab(pathname, handle);
  const hrefs = {
    feed: AppRoute.Feed,
    explore: AppRoute.Explore,
    agents: AppRoute.Agents,
    profile: handle ? profileHref(handle) : undefined,
    settings: AppRoute.Settings,
  };

  return (
    <div className="flex h-dvh flex-col bg-surface-canvas">
      <div className="flex min-h-0 flex-1 justify-center lg:py-3 lg:pr-3">
        <div className="flex min-h-0 w-full xl:max-w-[880px] 2xl:max-w-[920px]">
          <div className="hidden lg:flex">
            <SideNav
              active={active}
              hrefs={hrefs}
              linkAs={Link}
              user={user ? { name: user.profile.displayName, handle: user.profile.handle } : undefined}
            />
          </div>
          <main className="min-w-0 flex-1 overflow-y-auto bg-surface lg:rounded-[14px] lg:shadow-sheet">{children}</main>
        </div>
      </div>
      <div className="lg:hidden">
        <TabBar active={active} hrefs={hrefs} linkAs={Link} />
      </div>
    </div>
  );
}
