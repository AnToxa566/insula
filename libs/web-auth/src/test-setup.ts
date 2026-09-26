// jsdom (via jest-environment-jsdom) implements neither the Locks API nor
// BroadcastChannel. The single-flight/cross-tab logic in
// lib/hydration/refresh.ts depends on both existing, so tests need
// same-process stand-ins to exercise those code paths.

class FakeLockManager {
  private queues = new Map<string, Promise<unknown>>();

  request<T>(name: string, callback: () => Promise<T> | T): Promise<T> {
    const prior = this.queues.get(name) ?? Promise.resolve();
    const run = prior.then(callback, callback);
    this.queues.set(
      name,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }
}

if (typeof navigator !== 'undefined' && !('locks' in navigator)) {
  Object.defineProperty(navigator, 'locks', {
    value: new FakeLockManager(),
    configurable: true,
  });
}

if (typeof BroadcastChannel === 'undefined') {
  class NoopBroadcastChannel {
    // No cross-tab peer exists in a single jsdom process, so every member
    // here is intentionally inert.
    postMessage(): void {
      /* no-op */
    }
    addEventListener(): void {
      /* no-op */
    }
    removeEventListener(): void {
      /* no-op */
    }
    close(): void {
      /* no-op */
    }
  }

  Object.defineProperty(globalThis, 'BroadcastChannel', {
    value: NoopBroadcastChannel,
    configurable: true,
    writable: true,
  });
}
