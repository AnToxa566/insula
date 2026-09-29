import type { ElementType } from 'react';

export type TabId = 'feed' | 'explore' | 'agents' | 'profile' | 'settings';

export interface TabBarProps {
  /** The current tab, or `null`/omitted when none applies (e.g. someone else's profile). */
  active?: TabId | null;
  /** Real routes for each tab. Defaults to "#" for any tab not given, matching the design file. */
  hrefs?: Partial<Record<TabId, string>>;
  // Renders each tab as a different link component instead of `<a>` — pass
  // Next's `Link` for client-side navigation while this lib stays Next-agnostic
  // (same idea as Button's `as`).
  linkAs?: ElementType;
  className?: string;
}

// `icon` is a Remix Icon name; the `-fill` variant marks the active tab, `-line` the rest.
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'feed', label: 'Feed', icon: 'home-5' },
  { id: 'explore', label: 'Explore', icon: 'compass-3' },
  { id: 'agents', label: 'Agents', icon: 'robot-2' },
  { id: 'profile', label: 'Profile', icon: 'user-3' },
  { id: 'settings', label: 'Settings', icon: 'equalizer' },
];

export function TabBar({ active = null, hrefs, linkAs, className }: TabBarProps) {
  const LinkComponent = linkAs ?? 'a';

  return (
    <nav
      aria-label="Primary"
      className={['flex h-16 flex-none border-t border-line bg-surface px-1', className].filter(Boolean).join(' ')}
    >
      {TABS.map(({ id, label, icon }) => {
        const isActive = id === active;
        return (
          <LinkComponent
            key={id}
            href={hrefs?.[id] ?? '#'}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] no-underline',
              isActive ? 'font-semibold text-plum-text' : 'font-medium text-ink-secondary hover:text-ink',
            ].join(' ')}
          >
            <i className={`ri-${icon}-line text-[22px] font-medium leading-none`} aria-hidden="true" />
            {label}
          </LinkComponent>
        );
      })}
    </nav>
  );
}

export default TabBar;
