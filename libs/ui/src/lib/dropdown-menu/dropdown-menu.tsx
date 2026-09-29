'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface DropdownMenuItem {
  type: 'item';
  id: string;
  label: string;
  /** A Remix Icon name without the `ri-` prefix or `-line` suffix, e.g. `pencil`. Optional. */
  icon?: string;
  /** Destructive action. The design puts these last, after a divider. */
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface DropdownMenuDivider {
  type: 'divider';
}

export type DropdownMenuEntry = DropdownMenuItem | DropdownMenuDivider;

export interface DropdownMenuProps {
  // Content of the `<button>` this component owns, so aria-haspopup/expanded/
  // controls are wired in one place rather than by every caller.
  trigger: (state: { open: boolean }) => ReactNode;
  items: DropdownMenuEntry[];
  /** Accessible name for the trigger button. */
  label: string;
  /** `auto` opens down and flips up when there is less than the menu's height below the trigger. */
  placement?: 'auto' | 'up' | 'down';
  /** Which trigger edge the menu lines up with. */
  align?: 'start' | 'end';
  /** Classes for the wrapper around trigger + menu (e.g. `mt-auto`, `w-full`). */
  className?: string;
  triggerClassName?: string;
}

// Menu-to-trigger gap from the design (6px). Used both for the classes below
// and for the flip measurement, so keep them in step.
const OFFSET_PX = 6;

// One-off values with no token: menu shadow (light/dark), icon #66625B (dark
// uses ink-secondary), danger hover #F8E9E6. Item hover is surface-canvas in
// light and surface-subtle in dark. Dark danger hover has no design value, so
// it reuses the same dark item hover.
// Enter motion is 120ms opacity + 4px translate via Tailwind's `starting:`
// variant. Known deviation: the design's 80ms exit fade is skipped — the menu
// unmounts immediately on close.
const menuBase =
  'absolute z-20 min-w-[max(176px,100%)] max-w-[280px] flex flex-col rounded-xl bg-surface p-1 ' +
  'shadow-[0_0_0_1px_rgba(26,25,23,.08),0_8px_24px_rgba(26,25,23,.10)] ' +
  'dark:shadow-[0_0_0_1px_rgba(255,255,255,.08),0_8px_24px_rgba(0,0,0,.45)] ' +
  'transition-[opacity,translate] duration-[120ms] ease-out starting:translate-y-1 starting:opacity-0 ' +
  'motion-reduce:transition-none motion-reduce:starting:translate-y-0';
const itemBase =
  'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium leading-[1.4] outline-none ' +
  'focus-visible:shadow-[inset_0_0_0_1px_var(--color-plum)]';
const defaultItem = 'cursor-pointer text-ink hover:bg-surface-canvas dark:hover:bg-surface-subtle';
const dangerItem = 'cursor-pointer text-danger hover:bg-[#F8E9E6] dark:hover:bg-surface-subtle';
const disabledItem = 'cursor-default text-ink-muted';

function isItem(entry: DropdownMenuEntry): entry is DropdownMenuItem {
  return entry.type === 'item';
}

export function DropdownMenu({
  trigger,
  items,
  label,
  placement = 'auto',
  align = 'start',
  className,
  triggerClassName,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  // Only meaningful for `auto`; resolved on open in a layout effect, before paint.
  const [flipUp, setFlipUp] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Which item to focus once the menu mounts; set by whatever opened it.
  const initialFocus = useRef<'first' | 'last'>('first');

  const enabledItems = useCallback(
    () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []),
    [],
  );

  const openMenu = useCallback((focus: 'first' | 'last') => {
    initialFocus.current = focus;
    setOpen(true);
  }, []);

  // Closing always hands focus back to the trigger.
  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || placement !== 'auto') {
      return;
    }
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    if (!triggerRect) {
      return;
    }
    setFlipUp(window.innerHeight - triggerRect.bottom < menuHeight + OFFSET_PX);
  }, [open, placement]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const focusable = enabledItems();
    (initialFocus.current === 'last' ? focusable[focusable.length - 1] : focusable[0])?.focus();
  }, [open, enabledItems]);

  useEffect(() => {
    if (!open) {
      return;
    }
    // Outside pointer-down only: a press on the trigger stays "inside" so its
    // own click handler does the toggle (second click closes).
    function onPointerDown(event: Event) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    // Enter/Space arrive as a native click on the button; only the arrows need handling here.
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === 'Tab') {
      // Focus the trigger first (no preventDefault) so Tab continues from it
      // instead of from an element that is about to unmount.
      closeMenu();
      return;
    }

    const focusable = enabledItems();
    if (focusable.length === 0) {
      return;
    }
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === 'ArrowDown') {
      next = (current + 1) % focusable.length;
    } else if (event.key === 'ArrowUp') {
      next = current <= 0 ? focusable.length - 1 : current - 1;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = focusable.length - 1;
    }
    if (next !== null) {
      event.preventDefault();
      focusable[next].focus();
    }
  }

  const goesUp = placement === 'up' || (placement === 'auto' && flipUp);

  return (
    <div ref={wrapperRef} className={['relative', className].filter(Boolean).join(' ')}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={triggerClassName}
        onClick={() => (open ? closeMenu() : openMenu('first'))}
        onKeyDown={onTriggerKeyDown}
      >
        {trigger({ open })}
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={[
            menuBase,
            goesUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
            align === 'end' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          {items.map((entry, index) => {
            if (!isItem(entry)) {
              return <div key={`divider-${index}`} role="separator" className="mx-1.5 my-1 h-px bg-line" />;
            }
            const { id, label: itemLabel, icon, danger, disabled, onSelect } = entry;
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={disabled ? true : undefined}
                className={[
                  itemBase,
                  disabled ? disabledItem : danger ? dangerItem : defaultItem,
                ].join(' ')}
                onClick={() => {
                  if (disabled) {
                    return;
                  }
                  closeMenu();
                  onSelect();
                }}
              >
                {icon ? (
                  <i
                    className={`ri-${icon}-line text-[18px] leading-none ${
                      disabled || danger ? '' : 'text-[#66625B] dark:text-ink-secondary'
                    }`}
                    aria-hidden="true"
                  />
                ) : null}
                {itemLabel}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default DropdownMenu;
