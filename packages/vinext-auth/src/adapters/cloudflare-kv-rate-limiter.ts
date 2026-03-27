import type { RateLimiter } from '../types.js';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface AttemptRecord {
  count: number;
  resetAt: number;
}

/**
 * Cloudflare KV-backed rate limiter — persists across Worker isolates.
 *
 * Usage:
 * ```ts
 * import { CloudflareKVRateLimiter } from "vinextauth/adapters/cloudflare-kv-rate-limiter"
 *
 * VinextAuth({
 *   credentials: {
 *     rateLimit: {
 *       store: CloudflareKVRateLimiter(env.RATE_LIMIT_KV),
 *     },
 *   },
 * })
 * ```
 */
export function CloudflareKVRateLimiter(
  namespace: KVNamespace,
  options: { maxAttempts?: number; windowMs?: number } = {}
): RateLimiter {
  const maxAttempts = options.maxAttempts ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;

  function key(identifier: string): string {
    return `ratelimit:${identifier}`;
  }

  return {
    async check(identifier) {
      const now = Date.now();
      const raw = await namespace.get(key(identifier));
      const record: AttemptRecord = raw ? JSON.parse(raw) : { count: 0, resetAt: now + windowMs };

      if (now > record.resetAt) {
        const fresh: AttemptRecord = { count: 1, resetAt: now + windowMs };
        const ttl = Math.ceil(windowMs / 1000);
        await namespace.put(key(identifier), JSON.stringify(fresh), { expirationTtl: ttl });
        return { allowed: true };
      }

      if (record.count >= maxAttempts) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return { allowed: false, retryAfter };
      }

      record.count++;
      const ttl = Math.ceil((record.resetAt - now) / 1000);
      await namespace.put(key(identifier), JSON.stringify(record), { expirationTtl: ttl });
      return { allowed: true };
    },

    async reset(identifier) {
      await namespace.delete(key(identifier));
    },
  };
}
