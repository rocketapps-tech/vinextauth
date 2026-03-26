import { describe, it, expect } from 'vitest';
import { VinextAuth } from '../index.js';
import { sign } from '../../jwt/index.js';
import type { PagesRequest, PagesResponse } from '../../types.js';

// ─── Shared test config ────────────────────────────────────────────────────────

const TEST_SECRET = 'test-secret-32-chars-long-enough!!';
const BASE_URL = 'http://localhost:3001';

function makeAuth() {
  return VinextAuth({
    secret: TEST_SECRET,
    baseUrl: BASE_URL,
    providers: [],
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal PagesRequest */
function makeReq(overrides: Partial<PagesRequest> = {}): PagesRequest {
  return {
    method: 'GET',
    url: '/api/auth/session',
    headers: { host: 'localhost:3001' },
    cookies: {},
    ...overrides,
  };
}

/** Build a mock PagesResponse that captures what was written */
function makeRes() {
  const captured: {
    statusCode: number;
    headers: Record<string, string | string[]>;
    body: string;
  } = { statusCode: 200, headers: {}, body: '' };

  const res: PagesResponse = {
    status(code) {
      captured.statusCode = code;
      return res;
    },
    setHeader(key, value) {
      captured.headers[key.toLowerCase()] = value;
    },
    send(body) {
      captured.body = body;
    },
  };

  return { res, captured };
}

/** Sign a JWT session token for pagesAuth tests */
async function signSessionToken(payload: Record<string, unknown> = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      iat: now,
      exp: now + 3600,
      jti: 'test-jti',
      ...payload,
    },
    TEST_SECRET
  );
}

// ─── toPages() ────────────────────────────────────────────────────────────────

describe('toPages()', () => {
  it('returns a function', () => {
    const { toPages } = makeAuth();
    expect(typeof toPages()).toBe('function');
  });

  it('GET /api/auth/signin → returns HTML signin page', async () => {
    const { toPages } = makeAuth();
    const handler = toPages();
    const { res, captured } = makeRes();

    await handler(makeReq({ url: '/api/auth/signin' }), res);

    expect(captured.statusCode).toBe(200);
    expect(captured.headers['content-type']).toContain('text/html');
    expect(captured.body).toContain('<!DOCTYPE html');
  });

  it('GET /api/auth/session → returns empty object when no cookie', async () => {
    const { toPages } = makeAuth();
    const handler = toPages();
    const { res, captured } = makeRes();

    await handler(makeReq({ url: '/api/auth/session' }), res);

    expect(captured.statusCode).toBe(200);
    expect(JSON.parse(captured.body)).toEqual({});
  });

  it('GET /api/auth/csrf → returns a CSRF token', async () => {
    const { toPages } = makeAuth();
    const handler = toPages();
    const { res, captured } = makeRes();

    await handler(makeReq({ url: '/api/auth/csrf' }), res);

    expect(captured.statusCode).toBe(200);
    const body = JSON.parse(captured.body);
    expect(body).toHaveProperty('csrfToken');
    expect(typeof body.csrfToken).toBe('string');
  });

  it('GET /api/auth/providers → returns empty array when no providers', async () => {
    const { toPages } = makeAuth();
    const handler = toPages();
    const { res, captured } = makeRes();

    await handler(makeReq({ url: '/api/auth/providers' }), res);

    expect(captured.statusCode).toBe(200);
    expect(JSON.parse(captured.body)).toEqual([]);
  });

  it('GET unknown route → returns 404', async () => {
    const { toPages } = makeAuth();
    const handler = toPages();
    const { res, captured } = makeRes();

    await handler(makeReq({ url: '/api/auth/unknown-route' }), res);

    expect(captured.statusCode).toBe(404);
  });

  it('forwards cookies from req.headers to the Request', async () => {
    const token = await signSessionToken();
    const { toPages } = makeAuth();
    const handler = toPages();
    const { res, captured } = makeRes();

    await handler(
      makeReq({
        url: '/api/auth/session',
        headers: {
          host: 'localhost:3001',
          cookie: `vinext-auth.session-token=${token}`,
        },
        cookies: { 'vinext-auth.session-token': token },
      }),
      res
    );

    // Session route returns the session object directly (not wrapped in { session: ... })
    const body = JSON.parse(captured.body);
    expect(body).not.toEqual({});
    expect(body.user?.email).toBe('test@example.com');
  });

  it('sets response headers returned by the handler', async () => {
    const { toPages } = makeAuth();
    const handler = toPages();
    const { res, captured } = makeRes();

    await handler(makeReq({ url: '/api/auth/session' }), res);

    // All auth responses should have cache-control
    expect(captured.headers['cache-control']).toBeDefined();
  });

  it('handles JSON body on POST', async () => {
    const { toPages } = makeAuth();
    const handler = toPages();
    const { res, captured } = makeRes();

    // POST to signout — no CSRF so it will fail, but it should NOT crash
    await handler(
      makeReq({
        method: 'POST',
        url: '/api/auth/signout',
        headers: { host: 'localhost:3001', 'content-type': 'application/json' },
        body: { callbackUrl: '/' },
      }),
      res
    );

    // Fails CSRF check → 400-range status, but did not throw
    expect(captured.statusCode).toBeGreaterThanOrEqual(400);
  });
});

// ─── pagesAuth() ──────────────────────────────────────────────────────────────

describe('pagesAuth()', () => {
  it('returns null when no cookies', async () => {
    const { pagesAuth } = makeAuth();
    const session = await pagesAuth(makeReq());
    expect(session).toBeNull();
  });

  it('returns null for an invalid / tampered token', async () => {
    const { pagesAuth } = makeAuth();
    const session = await pagesAuth(
      makeReq({ cookies: { 'vinext-auth.session-token': 'invalid.token.value' } })
    );
    expect(session).toBeNull();
  });

  it('returns a valid session for a correctly signed token', async () => {
    const token = await signSessionToken();
    const { pagesAuth } = makeAuth();

    const session = await pagesAuth(makeReq({ cookies: { 'vinext-auth.session-token': token } }));

    expect(session).not.toBeNull();
    expect(session?.user.email).toBe('test@example.com');
    expect(session?.user.name).toBe('Test User');
  });

  it('returns null for an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      { sub: 'user-1', email: 'test@example.com', iat: now - 7200, exp: now - 3600 },
      TEST_SECRET
    );
    const { pagesAuth } = makeAuth();

    const session = await pagesAuth(makeReq({ cookies: { 'vinext-auth.session-token': token } }));

    expect(session).toBeNull();
  });

  it('reads from __Secure- prefixed cookie name', async () => {
    const token = await signSessionToken();

    // Force secure mode by providing the __Secure- prefixed cookie
    const { pagesAuth } = makeAuth();

    const session = await pagesAuth(
      makeReq({
        cookies: { '__Secure-vinext-auth.session-token': token },
      })
    );

    expect(session).not.toBeNull();
    expect(session?.user.email).toBe('test@example.com');
  });

  it('runs the session callback when configured', async () => {
    const token = await signSessionToken();

    const { pagesAuth } = VinextAuth({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [],
      callbacks: {
        session({ session }) {
          return { ...session, user: { ...session.user, role: 'admin' } };
        },
      },
    });

    type SessionWithRole = { user: { email?: string; role?: string }; expires: string };

    const session = (await pagesAuth<{ role?: string }>(
      makeReq({ cookies: { 'vinext-auth.session-token': token } })
    )) as SessionWithRole | null;

    expect(session?.user?.role).toBe('admin');
  });
});
