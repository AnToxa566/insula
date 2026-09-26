'use client';

import '../../lib/web-auth-config';

import { useAuthStatus } from '@insula/web-auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const status = useAuthStatus();

  // No flash of logged-out UI while the silent refresh from a page reload
  // is still in flight.
  if (status === 'idle' || status === 'hydrating') {
    return null;
  }

  return <>{children}</>;
}
