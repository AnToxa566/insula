import type { ElementType } from 'react';

import type { TabId } from '../tab-bar/tab-bar';

export interface SideNavUser {
  name: string;
  handle: string;
}

export interface SideNavProps {
  /** The current item, or `null`/omitted when none applies (e.g. someone else's profile). */
  active?: TabId | null;
  /** Real routes for each item. Defaults to "#" for any item not given, matching the design file. */
  hrefs?: Partial<Record<TabId, string>>;
  // Renders each item as a different link component instead of `<a>` — pass
  // Next's `Link` for client-side navigation while this lib stays Next-agnostic
  // (same idea as Button's `as`).
  linkAs?: ElementType;
  /** Signed-in user shown in the footer. The footer is omitted when not given. */
  user?: SideNavUser;
  className?: string;
}

// Sidebar says "My agents" (design/Nav.dc.html); the TabBar keeps "Agents".
// `icon` is a Remix Icon name; the `-fill` variant marks the active item, `-line` the rest.
const ITEMS: { id: TabId; label: string; icon: string }[] = [
  { id: 'feed', label: 'Feed', icon: 'home-5' },
  { id: 'explore', label: 'Explore', icon: 'compass-3' },
  { id: 'agents', label: 'My agents', icon: 'robot-2' },
  { id: 'profile', label: 'Profile', icon: 'user-3' },
  { id: 'settings', label: 'Settings', icon: 'equalizer' },
];

// One-off values with no token: idle text #66625B (dark uses ink-secondary),
// hover bg #EDEBE7 / dark #252422, and the active chip's 1px/1px shadow.
const itemBase = 'flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm leading-[1.4] no-underline';
const activeItem =
  'bg-surface font-semibold text-ink shadow-[0_0_0_1px_rgba(26,25,23,.06),0_1px_2px_rgba(26,25,23,.05)] dark:shadow-[0_0_0_1px_rgba(255,255,255,.08),0_1px_2px_rgba(0,0,0,.35)]';
const idleItem =
  'font-medium text-[#66625B] hover:bg-[#EDEBE7] hover:text-ink dark:text-ink-secondary dark:hover:bg-[#252422]';

export function SideNav({ active = null, hrefs, linkAs, user, className }: SideNavProps) {
  const LinkComponent = linkAs ?? 'a';

  return (
    <nav
      aria-label="Primary"
      className={['flex w-[200px] flex-none flex-col gap-0.5 px-3 pt-5 pb-2', className].filter(Boolean).join(' ')}
    >
      <div className="flex items-center gap-2 px-2.5 pb-7">
        <div className="h-[18px] w-[18px] rounded-md bg-plum" aria-hidden="true" />
        <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Insula</span>
      </div>

      {ITEMS.map(({ id, label, icon }) => {
        const isActive = id === active;
        return (
          <LinkComponent
            key={id}
            href={hrefs?.[id] ?? '#'}
            aria-current={isActive ? 'page' : undefined}
            className={[itemBase, isActive ? activeItem : idleItem].join(' ')}
          >
            <i
              className={`ri-${icon}-line text-[18px] font-medium leading-none ${isActive ? 'text-plum-text' : ''}`}
              aria-hidden="true"
            />
            {label}
          </LinkComponent>
        );
      })}

      {user ? (
        <div className="mt-auto flex items-center gap-2.5 px-2.5 py-2">
          <div
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-avatar text-xs font-semibold text-[#3F3D4A] dark:text-[#D6D4DE]"
            aria-hidden="true"
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium leading-[1.3] text-ink">{user.name}</div>
            <div className="truncate text-xs leading-[1.4] text-ink-secondary">@{user.handle}</div>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

export default SideNav;
