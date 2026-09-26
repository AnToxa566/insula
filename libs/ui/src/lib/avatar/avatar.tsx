import type { CSSProperties, HTMLAttributes } from 'react';

export type AvatarVariant = 'human' | 'agent';
export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  variant: AvatarVariant;
  initial: string;
  size?: AvatarSize;
  /** Background color for a human avatar in light mode. Ignored for the agent variant. */
  tone?: string;
  /**
   * Background color for a human avatar in dark mode. If omitted, dark mode
   * falls back to the neutral avatar token rather than the light `tone` —
   * pairing a light-only tone with dark-mode text would fail contrast.
   */
  toneDark?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-8 h-8 text-[13px] font-medium',
  md: 'w-10 h-10 text-[15px] font-semibold',
  lg: 'w-20 h-20 text-[28px] font-medium',
};

// Agent radius scales at 0.275x the avatar size (11px at 40px, per the design system).
const agentRadiusClasses: Record<AvatarSize, string> = {
  sm: 'rounded-[9px]',
  md: 'rounded-agent',
  lg: 'rounded-[22px]',
};

export function Avatar({ variant, initial, size = 'md', tone, toneDark, className, style, ...rest }: AvatarProps) {
  const base = 'flex-none flex items-center justify-center';

  if (variant === 'agent') {
    const classes = [
      base,
      sizeClasses[size],
      agentRadiusClasses[size],
      // Dark ring color is a distinct one-off (#9471C7), not the plum-text token.
      'bg-plum-tint border-agent border-plum dark:border-[#9471C7] text-plum-deep',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={classes} style={style} {...rest}>
        {initial}
      </div>
    );
  }

  // A tone WITH its own dark counterpart gets the toned dark text (#E4E2DD,
  // per PostRowDark.dc.html). Anything else — no tone, or a tone with no
  // toneDark — falls back to the neutral bg-avatar dark background (the
  // global.css avatar-tone rule falls back to --color-avatar when
  // --avatar-tone-dark isn't set) and its text (#D6D4DE, per Insula
  // Dark.dc.html's composer avatar). Falling back to the *light* tone in
  // dark mode would pair a light background with dark-mode text and fail
  // contrast (this bit us in review).
  const hasDarkTone = Boolean(tone && toneDark);
  const classes = [
    base,
    sizeClasses[size],
    hasDarkTone
      ? 'rounded-full text-[#3D3A34] dark:text-[#E4E2DD] avatar-tone'
      : 'rounded-full text-[#3D3A34] dark:text-[#D6D4DE]',
    tone && !hasDarkTone ? 'avatar-tone' : '',
    !tone ? 'bg-avatar' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // --avatar-tone-dark is only set when toneDark is explicitly given — left
  // unset, global.css's fallback (--color-avatar) applies in dark mode.
  const toneStyle: CSSProperties | undefined = tone
    ? ({
        '--avatar-tone-light': tone,
        ...(toneDark ? { '--avatar-tone-dark': toneDark } : {}),
        ...style,
      } as CSSProperties)
    : style;

  return (
    <div className={classes} style={toneStyle} {...rest}>
      {initial}
    </div>
  );
}

export default Avatar;
