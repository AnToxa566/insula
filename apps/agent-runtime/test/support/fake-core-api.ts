import { vi } from 'vitest';

import { TEST_BINDINGS } from '../bindings.js';

export interface RecordedRequest {
  method: string;
  // Path without the /api prefix, e.g. "/posts/<id>/like".
  path: string;
  search: string;
  headers: Record<string, string>;
  body: string;
}

export interface FakeCoreApiOptions {
  runtime?: unknown;
  runtimeStatus?: number;
  feed?: unknown[];
  explore?: unknown[];
  usageStatus?: number;
  // "PUT /posts/<id>/like" → status, for any write route.
  statusOverrides?: Record<string, number>;
  // Awaited before /runtime answers — lets a test hold a cycle open.
  beforeRuntime?: () => Promise<void>;
}

const CORE_ORIGIN = new URL(TEST_BINDINGS.CORE_API_URL).origin;

// Replaces globalThis.fetch for the test. It serves the core API routes the
// runtime uses, records every request, and refuses every other host — so
// a test can never reach a real model provider, even by accident.
export function installFakeCoreApi(options: FakeCoreApiOptions = {}) {
  const requests: RecordedRequest[] = [];
  const unexpectedHosts: string[] = [];

  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== CORE_ORIGIN) {
      unexpectedHosts.push(url.origin);
      throw new Error('fake core API: outbound request to an unexpected host');
    }

    const path = url.pathname.replace(/^\/api/, '');
    requests.push({
      method: request.method,
      path,
      search: url.search,
      headers: Object.fromEntries(request.headers),
      body: await request.text(),
    });

    const route = `${request.method} ${path}`;
    const override = options.statusOverrides?.[route];
    if (override !== undefined) {
      return Response.json({ statusCode: override, message: 'upstream detail the model must never see' }, { status: override });
    }

    if (request.method === 'GET' && /^\/agents\/[^/]+\/runtime$/.test(path)) {
      await options.beforeRuntime?.();
      if (options.runtimeStatus && options.runtimeStatus !== 200) {
        return Response.json({ message: 'nope' }, { status: options.runtimeStatus });
      }
      return Response.json(options.runtime);
    }
    if (request.method === 'GET' && (path === '/feed' || path === '/explore')) {
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const items = (path === '/feed' ? options.feed : options.explore) ?? [];
      return Response.json({ items: items.slice(0, limit), nextCursor: null });
    }
    if (request.method === 'POST' && /^\/agents\/[^/]+\/usage$/.test(path)) {
      return new Response(null, { status: options.usageStatus ?? 204 });
    }
    if (request.method === 'POST' && path === '/posts') {
      return Response.json({ id: crypto.randomUUID() }, { status: 201 });
    }
    if (request.method === 'POST' && /^\/posts\/[^/]+\/comments$/.test(path)) {
      return Response.json({ id: crypto.randomUUID() }, { status: 201 });
    }
    if (/^(PUT|DELETE) \/posts\/[^/]+\/like$/.test(route) || /^PUT \/profiles\/[^/]+\/follow$/.test(route)) {
      return new Response(null, { status: 204 });
    }
    return Response.json({ message: 'not found' }, { status: 404 });
  });

  return {
    requests,
    unexpectedHosts,
    spy,
    matching(method: string, pathPattern: RegExp): RecordedRequest[] {
      return requests.filter((r) => r.method === method && pathPattern.test(r.path));
    },
  };
}

export function decodeJwtPayload(authorization: string | undefined): Record<string, unknown> {
  const token = (authorization ?? '').replace(/^Bearer /, '');
  const payload = token.split('.')[1] ?? '';
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)));
}
