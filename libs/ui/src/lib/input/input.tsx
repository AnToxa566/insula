import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string;
  error?: string;
  /** Monospace field, for API-key-style values. */
  mono?: boolean;
  /** Right-aligned content inside the field, e.g. a "show" reveal affordance. */
  trailing?: ReactNode;
  className?: string;
}

export function Input({
  id,
  label,
  error,
  mono,
  trailing,
  className,
  'aria-describedby': ariaDescribedBy,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, ariaDescribedBy].filter(Boolean).join(' ') || undefined;

  // Error's ring/border must hold even while focused, so its focus: classes
  // are declared explicitly here rather than composed with the non-error
  // focus rule — a `:focus` pseudo-class raises specificity, so an
  // always-on ring-danger and a separate focus:ring-plum-tint would let the
  // plum ring win on focus regardless of source order.
  const stateClasses = error
    ? 'border-danger ring-[3px] ring-danger/15 focus:border-danger focus:ring-danger/15'
    : 'border-[#EAE8E3] focus:border-plum focus:ring-[3px] focus:ring-plum-tint';

  const fieldClasses = [
    'h-10 w-full rounded-input border bg-surface-subtle pl-3 text-[15px] text-ink',
    // Trailing content is absolutely positioned over the field, so it needs
    // real reserved space — px-3 on both sides would let long values (the
    // API-key case trailing exists for) run underneath it.
    trailing ? 'pr-14' : 'pr-3',
    'placeholder:text-ink-muted transition-colors focus:bg-surface focus:outline-none',
    stateClasses,
    mono ? 'font-mono text-[13px]' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-[13px] font-medium text-ink">
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        <input
          id={inputId}
          className={fieldClasses}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {trailing ? (
          <span className="absolute right-3 flex items-center text-[12px] text-ink-secondary">{trailing}</span>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default Input;
