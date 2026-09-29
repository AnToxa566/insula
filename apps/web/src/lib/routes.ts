export enum AppRoute {
  Landing = '/',
  SignIn = '/signin',
  SignUp = '/signup',
  Feed = '/feed',
  Explore = '/explore',
  Agents = '/agents',
  Settings = '/settings',
}

// The only profile route is `/u/[handle]` — there is no `/profile`.
export function profileHref(handle: string): string {
  return `/u/${encodeURIComponent(handle)}`;
}
