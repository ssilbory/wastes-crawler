import { describe, expect, it, vi } from 'vitest';
import { NAVIGATE_TIMEOUT_MS, serviceWorkerSource } from '../tools/pwa/service-worker.ts';

type Handler = (event: {
  request?: unknown;
  waitUntil: (p: unknown) => void;
  respondWith: (p: Promise<unknown>) => void;
}) => void;

/** Runs the generated worker against stand-in browser APIs and returns its handlers. */
function boot(fetchImpl: (req: unknown) => Promise<unknown>, cached: Record<string, string> = {}) {
  const handlers: Record<string, Handler> = {};
  const added: unknown[] = [];
  const deleted: string[] = [];
  const self = {
    location: { origin: 'https://game.test' },
    addEventListener: (kind: string, h: Handler) => (handlers[kind] = h),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => undefined) },
  };
  const caches = {
    open: async () => ({ addAll: async (reqs: unknown[]) => void added.push(...reqs) }),
    keys: async () => ['wastes-crawler-old', 'wastes-crawler-v1'],
    delete: async (k: string) => void deleted.push(k),
    match: async (req: string | { url: string }) =>
      cached[typeof req === 'string' ? req : req.url] ?? undefined,
  };
  class FakeRequest {
    constructor(
      public url: string,
      public init: RequestInit,
    ) {}
  }
  new Function('self', 'caches', 'fetch', 'Request', serviceWorkerSource(['index.html'], 'v1'))(
    self,
    caches,
    fetchImpl,
    FakeRequest,
  );
  /** What the worker answers a page load with. */
  const navigate = async () => {
    let answer: Promise<unknown> = Promise.resolve(undefined);
    handlers.fetch?.({
      request: { method: 'GET', url: 'https://game.test/', mode: 'navigate' },
      waitUntil: () => undefined,
      respondWith: (p) => (answer = p),
    });
    return answer;
  };
  const run = async (kind: string) => {
    let done: unknown;
    handlers[kind]?.({ waitUntil: (p) => (done = p), respondWith: () => undefined });
    await done;
  };
  return { self, added, deleted, navigate, run };
}

const page = (status: number) => ({ ok: status < 400, status });
const CACHED = { './index.html': 'cached page' };

describe('the generated service worker', () => {
  it('precaches past the HTTP cache, and waits for the old build’s tabs to close', async () => {
    const sw = boot(async () => page(200));
    await sw.run('install');
    expect(sw.added).toEqual([
      expect.objectContaining({ url: './', init: { cache: 'reload' } }),
      expect.objectContaining({ url: './index.html', init: { cache: 'reload' } }),
    ]);
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    await sw.run('activate');
    expect(sw.deleted).toEqual(['wastes-crawler-old']);
  });

  it('loads the page from the network when it answers in time', async () => {
    const fresh = page(200);
    expect(await boot(async () => fresh, CACHED).navigate()).toBe(fresh);
  });

  it('falls back on the cached game offline, or on an error page', async () => {
    expect(await boot(() => Promise.reject(new TypeError('offline')), CACHED).navigate()).toBe(
      'cached page',
    );
    expect(await boot(async () => page(503), CACHED).navigate()).toBe('cached page');
  });

  it('stops waiting on a slow network', async () => {
    vi.useFakeTimers();
    try {
      const answer = boot(() => new Promise(() => undefined), CACHED).navigate();
      await vi.advanceTimersByTimeAsync(NAVIGATE_TIMEOUT_MS);
      expect(await answer).toBe('cached page');
    } finally {
      vi.useRealTimers();
    }
  });

  it('with nothing cached, gives whatever the network gives', async () => {
    const error = page(503);
    expect(await boot(async () => error).navigate()).toBe(error);
  });
});
