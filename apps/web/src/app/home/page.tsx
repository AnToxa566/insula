import { RequireAuth } from '../providers/route-guards';

export default function HomePage() {
  return (
    <RequireAuth>
      <div className="flex h-dvh items-center justify-center">
        <p className="text-title font-semibold text-ink">Hello Home</p>
      </div>
    </RequireAuth>
  );
}
