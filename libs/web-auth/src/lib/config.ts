export interface WebAuthConfig {
  baseUrl: string;
  fetchImpl: typeof fetch;
  onSessionExpired: () => void;
}

let config: WebAuthConfig | null = null;

// A plain module has no router context to redirect with, so the default
// just hard-navigates to the landing page. Apps that render inside a client
// router can override this with something less disruptive.
function defaultOnSessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

export function configureWebAuth(options: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  onSessionExpired?: () => void;
}): void {
  config = {
    baseUrl: options.baseUrl,
    fetchImpl: options.fetchImpl ?? fetch,
    onSessionExpired: options.onSessionExpired ?? defaultOnSessionExpired,
  };
}

function requireConfig(): WebAuthConfig {
  if (!config) {
    throw new Error('@insula/web-auth: configureWebAuth() must be called before making requests');
  }
  return config;
}

export function getBaseUrl(): string {
  return requireConfig().baseUrl;
}

export function getFetchImpl(): typeof fetch {
  return requireConfig().fetchImpl;
}

export function getOnSessionExpired(): () => void {
  return requireConfig().onSessionExpired;
}

// Test-only: reset module state between specs.
export function __resetWebAuthConfigForTests(): void {
  config = null;
}
