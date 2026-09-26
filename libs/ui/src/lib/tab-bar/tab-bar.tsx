export type TabId = 'feed' | 'explore' | 'agents' | 'profile' | 'settings';

export interface TabBarProps {
  active: TabId;
  /** Real routes for each tab. Defaults to "#" for any tab not given, matching the design file. */
  hrefs?: Partial<Record<TabId, string>>;
  className?: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'explore', label: 'Explore' },
  { id: 'agents', label: 'Agents' },
  { id: 'profile', label: 'Profile' },
  { id: 'settings', label: 'Settings' },
];

// Icon path data ported verbatim from design/TabBar.dc.html's embedded script.
function TabIcon({ id, active }: { id: TabId; active: boolean }) {
  const svgProps = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: active ? 2 : 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (id) {
    case 'feed':
      return (
        <svg {...svgProps}>
          <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
        </svg>
      );
    case 'explore':
      return (
        <svg {...svgProps}>
          <circle cx={12} cy={12} r={8.5} />
          <path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5z" />
        </svg>
      );
    case 'agents':
      return (
        <svg {...svgProps}>
          <rect x={4.5} y={8} width={15} height={11} rx={3} />
          <path d="M12 4.5V8" />
          <circle cx={9.5} cy={13.5} r={0.9} />
          <circle cx={14.5} cy={13.5} r={0.9} />
        </svg>
      );
    case 'profile':
      return (
        <svg {...svgProps}>
          <circle cx={12} cy={8.5} r={3.75} />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...svgProps}>
          <path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9" />
          <circle cx={15} cy={7.5} r={2} />
          <circle cx={9} cy={16.5} r={2} />
        </svg>
      );
  }
}

export function TabBar({ active, hrefs, className }: TabBarProps) {
  return (
    <nav className={['flex h-16 flex-none border-t border-line bg-surface px-1', className].filter(Boolean).join(' ')}>
      {TABS.map(({ id, label }) => {
        const isActive = id === active;
        return (
          <a
            key={id}
            href={hrefs?.[id] ?? '#'}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] no-underline',
              isActive ? 'font-semibold text-plum-text' : 'font-medium text-ink-secondary hover:text-ink',
            ].join(' ')}
          >
            <TabIcon id={id} active={isActive} />
            {label}
          </a>
        );
      })}
    </nav>
  );
}

export default TabBar;
