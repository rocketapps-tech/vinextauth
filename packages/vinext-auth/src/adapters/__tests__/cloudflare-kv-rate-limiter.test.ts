import { describe, it, expect, beforeEach } from 'vitest';
import { CloudflareKVRateLimiter } from '../cloudflare-kv-rate-limiter.js';

// ─── In-memory KV stub ─────────────────────────────────────────────────────────

function makeKV() {
  const store = new Map<string, string>();
  return {
    async get(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string, _options?: { expirationTtl?: number }): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    _store: store,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('CloudflareKVRateLimiter', () => {
  let kv: ReturnType<typeof makeKV>;

  beforeEach(() => {
    kv = makeKV();
  });

  it('allows first request', async () => {
    const limiter = CloudflareKVRateLimiter(kv, { maxAttempts: 5, windowMs: 60_000 });
    const result = await limiter.check('user-1');
    expect(result.allowed).toBe(true);
  });

  it('allows up to maxAttempts within window', async () => {
    const limiter = CloudflareKVRateLimiter(kv, { maxAttempts: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) {
      const result = await limiter.check('user-2');
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks on maxAttempts + 1 and returns retryAfter', async () => {
    const limiter = CloudflareKVRateLimiter(kv, { maxAttempts: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) {
      await limiter.check('user-3');
    }
    const blocked = await limiter.check('user-3');
    expect(blocked.allowed).toBe(false);
    expect(typeof blocked.retryAfter).toBe('number');
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('resets after window expires', async () => {
    // Use a windowMs in the past by manipulating the stored record
    const limiter = CloudflareKVRateLimiter(kv, { maxAttempts: 1, windowMs: 60_000 });
    await limiter.check('user-4');
    const blocked = await limiter.check('user-4');
    expect(blocked.allowed).toBe(false);

    // Simulate window expired by writing a record with a past resetAt
    const expiredRecord = JSON.stringify({ count: 5, resetAt: Date.now() - 1 });
    await kv.put('ratelimit:user-4', expiredRecord);

    const allowed = await limiter.check('user-4');
    expect(allowed.allowed).toBe(true);
  });

  it('reset() clears the counter', async () => {
    const limiter = CloudflareKVRateLimiter(kv, { maxAttempts: 1, windowMs: 60_000 });
    await limiter.check('user-5');
    const blocked = await limiter.check('user-5');
    expect(blocked.allowed).toBe(false);

    await limiter.reset('user-5');
    const allowed = await limiter.check('user-5');
    expect(allowed.allowed).toBe(true);
  });

  it('tracks different identifiers independently', async () => {
    const limiter = CloudflareKVRateLimiter(kv, { maxAttempts: 1, windowMs: 60_000 });
    await limiter.check('key-a');
    const blocked = await limiter.check('key-a');
    expect(blocked.allowed).toBe(false);

    const allowed = await limiter.check('key-b');
    expect(allowed.allowed).toBe(true);
  });

  it('uses default options when none provided', async () => {
    const limiter = CloudflareKVRateLimiter(kv);
    // Should not throw and should allow first attempt
    const result = await limiter.check('default-user');
    expect(result.allowed).toBe(true);
  });
});
