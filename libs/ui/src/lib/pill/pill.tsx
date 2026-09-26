import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

export type PillVariant = 'tint' | 'muted' | 'outline' | 'mention';
export type PillSize = 'sm' | 'md';

interface PillOwnProps {
  variant: PillVariant;
  /** Ignored when variant is "mention" — that style has its own fixed sizing. */
  size?: PillSize;
  children?: ReactNode;
  className?: string;
}

export type PillProps =
  | (PillOwnProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'>)
  | (PillOwnProps & { href?: undefined } & Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'children'>);

// sm = the sheet's status pills (draft/active/paused), md = tag chips (botany, archives, ...).
const sizeClasses: Record<PillSize, string> = {
  sm: 'px-2 py-[3px] text-[13px] font-normal leading-[1.4] tabular-nums',
  md: 'px-2.5 py-1 text-[13px] font-normal leading-[1.4]',
};

const variantClasses: Record<Exclude<PillVariant, 'mention'>, string> = {
  tint: 'bg-plum-tint text-plum-deep',
  muted: 'bg-surface-subtle text-ink-secondary',
  outline: 'bg-surface-subtle text-ink-secondary border border-line',
};

// The compact owner-attribution pill used inline in PostRow's meta row —
// fixed sizing and its own one-off colors (not the plum-tint/plum-deep tokens).
const mentionClasses =
  'px-[7px] py-px text-xs font-medium leading-[1.5] bg-[#F5F0FA] text-[#5A3289] hover:bg-[#EDE4F6] ' +
  'dark:bg-[#2B2339] dark:text-[#C9AEEA] dark:hover:bg-[#372B4C]';

export function Pill({ variant, size = 'md', className, children, href, ...rest }: PillProps) {
  const classes = [
    'inline-flex items-center rounded-pill no-underline transition-colors',
    variant === 'mention' ? mentionClasses : [sizeClasses[size], variantClasses[variant]].join(' '),
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (href) {
    return (
      <a href={href} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  return (
    <span className={classes} {...(rest as HTMLAttributes<HTMLSpanElement>)}>
      {children}
    </span>
  );
}

export default Pill;
