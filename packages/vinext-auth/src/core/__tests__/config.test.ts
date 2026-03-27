import { describe, it, expect, vi } from 'vitest';
import { resolveConfig, resolveBaseUrl } from '../config.js';

const SECRET = 'test-secret-32-chars-long-enough!!';
const BASE_URL = 'http://localhost:3001';

describe('resolveConfig', () => {
  it('throws when no secret is provided and no env var', () => {
    expect(() => resolveConfig({ providers: [] } as never)).toThrow(/No secret provided/);
  });

  it('accepts secret via config.secret', () => {
    const config = resolveConfig({ secret: SECRET, providers: [], baseUrl: BASE_URL });
    expect(config.secret).toBe(SECRET);
  });

  it('reads secret from VINEXTAUTH_SECRET env var', () => {
    vi.stubEnv('VINEXTAUTH_SECRET', SECRET);
    const config = resolveConfig({ providers: [], baseUrl: BASE_URL } as never);
    expect(config.secret).toBe(SECRET);
    vi.unstubAllEnvs();
  });

  it('prepends https:// when baseUrl has no protocol', () => {
    const config = resolveConfig({ secret: SECRET, providers: [], baseUrl: 'myapp.example.com' });
    expect(config.baseUrl).toBe('https://myapp.example.com');
  });

  it('keeps baseUrl as-is when it already has http://', () => {
    const config = resolveConfig({ secret: SECRET, providers: [], baseUrl: BASE_URL });
    expect(config.baseUrl).toBe(BASE_URL);
  });

  it('keeps baseUrl as-is when it already has https://', () => {
    const config = resolveConfig({
      secret: SECRET,
      providers: [],
      baseUrl: 'https://myapp.example.com',
    });
    expect(config.baseUrl).toBe('https://myapp.example.com');
  });

  it('accepts baseUrl as a function (multi-tenant)', () => {
    const fn = async () => 'tenant.example.com';
    const config = resolveConfig({ secret: SECRET, providers: [], baseUrl: fn });
    expect(typeof config.baseUrl).toBe('function');
  });

  it('uses VINEXTAUTH_URL env var as fallback for baseUrl', () => {
    vi.stubEnv('VINEXTAUTH_URL', 'https://env-url.example.com');
    const config = resolveConfig({ secret: SECRET, providers: [] } as never);
    expect(config.baseUrl).toBe('https://env-url.example.com');
    vi.unstubAllEnvs();
  });

  it('defaults to http://localhost:3000 when no baseUrl is provided', () => {
    const config = resolveConfig({ secret: SECRET, providers: [] } as never);
    expect(config.baseUrl).toBe('http://localhost:3000');
  });

  it('enables secure cookies for https:// baseUrl', () => {
    const config = resolveConfig({
      secret: SECRET,
      providers: [],
      baseUrl: 'https://myapp.example.com',
    });
    expect(config.useSecureCookies).toBe(true);
  });

  it('disables secure cookies for http:// baseUrl', () => {
    const config = resolveConfig({ secret: SECRET, providers: [], baseUrl: BASE_URL });
    expect(config.useSecureCookies).toBe(false);
  });

  it('respects explicit useSecureCookies override', () => {
    const config = resolveConfig({
      secret: SECRET,
      providers: [],
      baseUrl: BASE_URL, // http — would normally be false
      useSecureCookies: true,
    });
    expect(config.useSecureCookies).toBe(true);
  });

  it('uses default session maxAge of 30 days', () => {
    const config = resolveConfig({ secret: SECRET, providers: [], baseUrl: BASE_URL });
    expect(config.session.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it('respects custom session.maxAge', () => {
    const config = resolveConfig({
      secret: SECRET,
      providers: [],
      baseUrl: BASE_URL,
      session: { maxAge: 3600 },
    });
    expect(config.session.maxAge).toBe(3600);
  });

  it('defaults to jwt strategy', () => {
    const config = resolveConfig({ secret: SECRET, providers: [], baseUrl: BASE_URL });
    expect(config.session.strategy).toBe('jwt');
  });

  it('respects database strategy', () => {
    const config = resolveConfig({
      secret: SECRET,
      providers: [],
      baseUrl: BASE_URL,
      session: { strategy: 'database' },
    });
    expect(config.session.strategy).toBe('database');
  });

  it('defaults pages to the standard auth paths', () => {
    const config = resolveConfig({ secret: SECRET, providers: [], baseUrl: BASE_URL });
    expect(config.pages.signIn).toBe('/api/auth/signin');
    expect(config.pages.error).toBe('/api/auth/error');
    expect(config.pages.verifyRequest).toBe('/api/auth/verify-request');
  });

  it('merges custom pages', () => {
    const config = resolveConfig({
      secret: SECRET,
      providers: [],
      baseUrl: BASE_URL,
      pages: { signIn: '/login', error: '/auth-error' },
    });
    expect(config.pages.signIn).toBe('/login');
    expect(config.pages.error).toBe('/auth-error');
    expect(config.pages.verifyRequest).toBe('/api/auth/verify-request'); // default kept
  });

  it('merges events', () => {
    const signIn = vi.fn();
    const config = resolveConfig({
      secret: SECRET,
      providers: [],
      baseUrl: BASE_URL,
      events: { signIn },
    });
    expect(config.events.signIn).toBe(signIn);
  });

  it('sets accountLinking defaults', () => {
    const config = resolveConfig({ secret: SECRET, providers: [], baseUrl: BASE_URL });
    expect(config.accountLinking.enabled).toBe(false);
    expect(config.accountLinking.requireVerification).toBe(true);
  });

  it('respects accountLinking overrides', () => {
    const config = resolveConfig({
      secret: SECRET,
      providers: [],
      baseUrl: BASE_URL,
      accountLinking: { enabled: true, requireVerification: false },
    });
    expect(config.accountLinking.enabled).toBe(true);
    expect(config.accountLinking.requireVerification).toBe(false);
  });

  it('uses custom rateLimit store when provided', () => {
    const store = {
      check: async () => ({ allowed: true }),
      reset: async () => {},
    };
    const config = resolveConfig({
      secret: SECRET,
      providers: [],
      baseUrl: BASE_URL,
      credentials: { rateLimit: { store } },
    });
    expect(config._rateLimiter).toBe(store);
  });
});

describe('resolveBaseUrl', () => {
  it('returns the static baseUrl string', async () => {
    const config = resolveConfig({ secret: SECRET, providers: [], baseUrl: BASE_URL });
    const req = new Request(BASE_URL);
    const result = await resolveBaseUrl(config, req);
    expect(result).toBe(BASE_URL);
  });

  it('calls the function and prepends https:// if missing', async () => {
    const config = resolveConfig({
      secret: SECRET,
      providers: [],
      baseUrl: async () => 'tenant.example.com',
    });
    const req = new Request('http://tenant.example.com/');
    const result = await resolveBaseUrl(config, req);
    expect(result).toBe('https://tenant.example.com');
  });

  it('calls the function and returns as-is when https:// present', async () => {
    const config = resolveConfig({
      secret: SECRET,
      providers: [],
      baseUrl: async () => 'https://tenant.example.com',
    });
    const req = new Request('https://tenant.example.com/');
    const result = await resolveBaseUrl(config, req);
    expect(result).toBe('https://tenant.example.com');
  });
});
