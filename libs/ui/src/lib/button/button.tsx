import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'following' | 'danger' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'compact';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 text-sm',
  md: 'h-11 text-[15px]',
  compact: 'h-[30px] text-[13px]',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'rounded-full bg-plum text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(54,29,87,.3)] hover:bg-[#5A3289]',
  // The surface token (not a hardcoded white) plus an arbitrary-value shadow
  // reading the --shadow-outline CSS variable directly — both flip correctly
  // in dark mode. A *named* theme-shadow utility would NOT work here:
  // Tailwind v4 bakes a named theme shadow's light value into the compiled
  // --tw-shadow at build time, so redefining the underlying variable under
  // the dark theme selector would never be read at paint time. Referencing
  // the variable directly re-evaluates whenever the theme flips.
  secondary: 'rounded-full bg-surface text-ink font-medium shadow-[var(--shadow-outline)] hover:bg-surface-subtle',
  ghost: 'rounded-lg bg-transparent text-ink font-medium hover:bg-[rgba(54,29,87,.06)]',
  following: 'rounded-full bg-surface-canvas text-ink-secondary font-medium',
  danger:
    'rounded-full bg-surface text-danger font-medium shadow-[var(--shadow-outline)] hover:bg-surface-subtle',
  icon: 'w-8 h-8 rounded-lg bg-surface-subtle text-ink p-0',
};

function paddingClass(variant: ButtonVariant, size: ButtonSize) {
  if (variant === 'ghost') {
    return 'px-4';
  }
  if (size === 'compact') {
    return 'px-3.5';
  }
  return size === 'md' ? 'px-5' : 'px-4';
}

export function Button({
  variant,
  size = 'md',
  className,
  type,
  children,
  ...rest
}: ButtonProps) {
  // The icon variant is a fixed 32x32 square — it ignores `size` entirely
  // rather than relying on Tailwind class string order to win the cascade.
  const classes = (
    variant === 'icon'
      ? [
          'inline-flex items-center justify-center transition-colors',
          'disabled:opacity-50 disabled:pointer-events-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum/50',
          variantClasses.icon,
        ]
      : [
          'inline-flex items-center justify-center whitespace-nowrap transition-colors',
          'disabled:opacity-50 disabled:pointer-events-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum/50',
          sizeClasses[size],
          paddingClass(variant, size),
          variantClasses[variant],
        ]
  )
    .concat(className ?? [])
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type ?? 'button'} className={classes} {...rest}>
      {children}
    </button>
  );
}

export default Button;
