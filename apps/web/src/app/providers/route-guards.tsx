'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useIsAuthenticated } from '@insula/web-auth';

import { AppRoute } from '../../lib/routes';

// AuthProvider (root layout) already renders `null` until useAuthStatus()
// leaves 'idle'/'hydrating', so by the time either guard below mounts, auth
// status has already resolved — no loading state to handle here, just
// redirect on mismatch.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated) router.replace(AppRoute.SignIn);
  }, [isAuthenticated, router]);
  return isAuthenticated ? <>{children}</> : null;
}

export function RequireGuest({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  useEffect(() => {
    if (isAuthenticated) router.replace(AppRoute.Feed);
  }, [isAuthenticated, router]);
  return isAuthenticated ? null : <>{children}</>;
}
