import type { RateLimiter } from '../types.js';

interface Attempt {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limiter.
 * For production, use a Redis or KV-backed store via the `store` option.
 *
 * Automatically cleans up expired entries every 5 minutes.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private store = new Map<string, Attempt>();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;

    // Auto-cleanup every 5 minutes — unref so it doesn't keep the process alive
    if (typeof setInterval !== 'undefined') {
      const interval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      if (interval && typeof interval === 'object' && 'unref' in interval) {
        (interval as { unref(): void }).unref();
      }
    }
  }

  async check(key: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now();
    const attempt = this.store.get(key);

    if (!attempt || now > attempt.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }

    if (attempt.count >= this.maxAttempts) {
      const retryAfter = Math.ceil((attempt.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }

    attempt.count++;
    return { allowed: true };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, attempt] of this.store) {
      if (now > attempt.resetAt) this.store.delete(key);
    }
  }
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
