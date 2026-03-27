import { describe, it, expect } from 'vitest';
import { InMemoryRateLimiter, getClientIp } from '../rate-limiter.js';

describe('InMemoryRateLimiter', () => {
  it('allows first request', async () => {
    const limiter = new InMemoryRateLimiter(5, 60_000);
    const result = await limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('allows up to maxAttempts within the window', async () => {
    const limiter = new InMemoryRateLimiter(3, 60_000);
    for (let i = 0; i < 3; i++) {
      const result = await limiter.check('user-2');
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks on maxAttempts + 1 and returns retryAfter', async () => {
    const limiter = new InMemoryRateLimiter(3, 60_000);
    for (let i = 0; i < 3; i++) {
      await limiter.check('user-3');
    }
    const blocked = await limiter.check('user-3');
    expect(blocked.allowed).toBe(false);
    expect(typeof blocked.retryAfter).toBe('number');
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('resets counter after window expires', async () => {
    // Use a 1ms window so it expires immediately
    const limiter = new InMemoryRateLimiter(2, 1);
    await limiter.check('user-4');
    await limiter.check('user-4');
    // Exhaust attempts
    const blocked = await limiter.check('user-4');
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 5));

    const allowed = await limiter.check('user-4');
    expect(allowed.allowed).toBe(true);
  });

  it('reset() clears the counter immediately', async () => {
    const limiter = new InMemoryRateLimiter(2, 60_000);
    await limiter.check('user-5');
    await limiter.check('user-5');
    const blocked = await limiter.check('user-5');
    expect(blocked.allowed).toBe(false);

    await limiter.reset('user-5');
    const allowed = await limiter.check('user-5');
    expect(allowed.allowed).toBe(true);
  });

  it('tracks different keys independently', async () => {
    const limiter = new InMemoryRateLimiter(1, 60_000);
    await limiter.check('key-a');
    const blocked = await limiter.check('key-a');
    expect(blocked.allowed).toBe(false);

    const allowed = await limiter.check('key-b');
    expect(allowed.allowed).toBe(true);
  });

  it('retryAfter is approximately the window remaining in seconds', async () => {
    const windowMs = 60_000;
    const limiter = new InMemoryRateLimiter(1, windowMs);
    await limiter.check('user-6');
    const { retryAfter } = await limiter.check('user-6');
    // retryAfter should be close to windowMs/1000 = 60
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });
});

describe('getClientIp', () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request('http://localhost/', { headers });
  }

  it('prefers cf-connecting-ip over x-forwarded-for', () => {
    const req = makeRequest({
      'cf-connecting-ip': '1.2.3.4',
      'x-forwarded-for': '5.6.7.8',
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('uses x-real-ip when cf-connecting-ip is absent', () => {
    const req = makeRequest({ 'x-real-ip': '10.0.0.1' });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('uses first IP in x-forwarded-for list', () => {
    const req = makeRequest({ 'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1' });
    expect(getClientIp(req)).toBe('192.168.1.1');
  });

  it('returns "unknown" when no IP headers present', () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe('unknown');
  });

  it('prefers cf-connecting-ip over x-real-ip', () => {
    const req = makeRequest({
      'cf-connecting-ip': '1.1.1.1',
      'x-real-ip': '2.2.2.2',
    });
    expect(getClientIp(req)).toBe('1.1.1.1');
  });
});
