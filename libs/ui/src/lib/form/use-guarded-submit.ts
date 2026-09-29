'use client';

import { useCallback, useRef } from 'react';

// Wrap the INNER async callback, not the outer form.handleSubmit(...) —
// i.e. `form.handleSubmit(useGuardedSubmit(onValid))`, never
// `useGuardedSubmit(form.handleSubmit(onValid))`. RHF's handleSubmit calls
// event.preventDefault() unconditionally on every invocation; if the guard
// wraps that outer function instead, a short-circuited (already-pending)
// call returns before ever reaching preventDefault, and two clicks close
// enough together fall through to the browser's native form submission —
// confirmed via two same-tick native clicks producing a real
// `GET /?email=...` navigation before this comment existed.
export function useGuardedSubmit<Args extends unknown[]>(
  handler: (...args: Args) => Promise<void>,
): (...args: Args) => Promise<void> {
  const pending = useRef(false);
  return useCallback(
    async (...args: Args) => {
      if (pending.current) return;
      pending.current = true;
      try {
        await handler(...args);
      } finally {
        pending.current = false;
      }
    },
    [handler],
  );
}
