import { RequireAuth } from '../providers/route-guards';
import { AppShell } from './_components/app-shell';

// Every authorized page lives in this route group, so the auth guard and the
// shell (sidebar / tab bar) are mounted once here instead of per page.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
