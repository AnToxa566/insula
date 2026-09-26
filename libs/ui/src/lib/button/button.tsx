import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 text-sm',
  md: 'h-11 text-[15px]',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'rounded-full bg-plum text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(54,29,87,.3)] hover:bg-[#5A3289]',
  secondary:
    'rounded-full bg-white text-ink font-medium shadow-[0_0_0_1px_rgba(26,25,23,.12),0_1px_2px_rgba(26,25,23,.05)] hover:bg-surface-subtle',
  ghost: 'rounded-lg bg-transparent text-ink font-medium hover:bg-[rgba(54,29,87,.06)]',
};

function paddingClass(variant: ButtonVariant, size: ButtonSize) {
  if (variant === 'ghost') {
    return 'px-4';
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
  const classes = [
    'inline-flex items-center justify-center whitespace-nowrap transition-colors',
    'disabled:opacity-50 disabled:pointer-events-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum/50',
    sizeClasses[size],
    paddingClass(variant, size),
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type ?? 'button'} className={classes} {...rest}>
      {children}
    </button>
  );
}

export default Button;
