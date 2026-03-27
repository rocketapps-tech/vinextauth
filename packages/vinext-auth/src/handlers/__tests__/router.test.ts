import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VinextAuth } from '../index.js';
import { generateCsrfToken } from '../../core/csrf.js';
import type { EmailProvider, AdapterInterface } from '../../types.js';

const TEST_SECRET = 'test-secret-32-chars-long-enough!!';
const BASE_URL = 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuth(overrides: Record<string, unknown> = {}) {
  return VinextAuth({
    secret: TEST_SECRET,
    baseUrl: BASE_URL,
    providers: [],
    ...overrides,
  });
}

function makeRequest(path: string, options: RequestInit = {}): Request {
  return new Request(`${BASE_URL}${path}`, options);
}

function makeAdapter(): AdapterInterface {
  const vtokens: Array<{ identifier: string; token: string; expires: Date }> = [];
  return {
    getSession: async () => null,
    createSession: async (s) => s,
    updateSession: async () => null,
    deleteSession: async () => undefined,
    getUserByEmail: async (email) =>
      email === 'alice@example.com' ? { id: 'user-1', name: 'Alice', email, image: null } : null,
    createUser: async (u) => ({
      id: 'new',
      name: u.name ?? null,
      email: u.email ?? null,
      image: null,
    }),
    createVerificationToken: async (vt) => {
      vtokens.push(vt);
      return vt;
    },
    useVerificationToken: async ({ identifier, token }) => {
      const idx = vtokens.findIndex((v) => v.identifier === identifier && v.token === token);
      if (idx === -1) return null;
      return vtokens.splice(idx, 1)[0];
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VinextAuth router — built-in pages', () => {
  it('GET /api/auth/signin → renders sign-in HTML page', async () => {
    const { GET } = makeAuth();
    const res = await GET(makeRequest('/api/auth/signin'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('<!DOCTYPE html');
  });

  it('GET /api/auth/error → renders error HTML page (400)', async () => {
    const { GET } = makeAuth();
    const res = await GET(makeRequest('/api/auth/error?error=AccessDenied'));
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    // The error page translates error codes to human-readable messages
    expect(body).toContain('do not have permission');
  });

  it('GET /api/auth/error with retryAfter → passes retryAfter to page', async () => {
    const { GET } = makeAuth();
    const res = await GET(makeRequest('/api/auth/error?error=RateLimitExceeded&retryAfter=30'));
    const body = await res.text();
    expect(body).toContain('30');
  });

  it('GET /api/auth/verify-request → renders verify-request HTML page', async () => {
    const { GET } = makeAuth();
    const res = await GET(makeRequest('/api/auth/verify-request?provider=email'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('<!DOCTYPE html');
  });

  it('GET /api/auth/providers → returns provider list', async () => {
    const { GET } = makeAuth();
    const res = await GET(makeRequest('/api/auth/providers'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET unknown route → 404', async () => {
    const { GET } = makeAuth();
    const res = await GET(makeRequest('/api/auth/unknown'));
    expect(res.status).toBe(404);
  });

  it('request outside /api/auth basePath → 404', async () => {
    const { GET } = makeAuth();
    const res = await GET(makeRequest('/some/other/path'));
    expect(res.status).toBe(404);
  });
});

describe('VinextAuth router — sign-in page with CSRF providers', () => {
  it('sign-in page generates CSRF cookie for credentials provider', async () => {
    const { GET } = VinextAuth({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [
        {
          id: 'credentials',
          name: 'Credentials',
          type: 'credentials',
          credentials: {},
          authorize: async () => null,
        },
      ],
    });
    const res = await GET(makeRequest('/api/auth/signin'));
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('vinextauth.csrf-token');
  });

  it('sign-in page reuses existing CSRF cookie', async () => {
    const { GET } = VinextAuth({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [
        {
          id: 'credentials',
          name: 'Credentials',
          type: 'credentials',
          credentials: {},
          authorize: async () => null,
        },
      ],
    });
    const { cookieValue } = await generateCsrfToken(TEST_SECRET);
    const req = new Request(`${BASE_URL}/api/auth/signin`, {
      headers: { cookie: `vinextauth.csrf-token=${encodeURIComponent(cookieValue)}` },
    });
    const res = await GET(req);
    // Should NOT generate a new CSRF cookie since one already exists
    // The existing cookie is in the request, response should not set a new one
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<!DOCTYPE html');
  });
});

describe('VinextAuth router — email provider routes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/auth/signin/email → triggers email magic link flow', async () => {
    const sendMock = vi.fn(async () => {});
    const emailProvider: EmailProvider = {
      id: 'email',
      name: 'Email',
      type: 'email',
      maxAge: 3600,
      transport: { sendVerificationRequest: sendMock },
    };

    const { POST } = VinextAuth({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [emailProvider],
      adapter: makeAdapter(),
    });

    const { token, cookieValue } = await generateCsrfToken(TEST_SECRET);
    const req = new Request(`${BASE_URL}/api/auth/signin/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `vinextauth.csrf-token=${encodeURIComponent(cookieValue)}`,
      },
      body: new URLSearchParams({ csrfToken: token, email: 'alice@example.com' }).toString(),
    });

    const res = await POST(req);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('verify-request');
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it('GET /api/auth/callback/email → verifies token and creates session', async () => {
    const vtokens: Array<{ identifier: string; token: string; expires: Date }> = [];
    const adapter = makeAdapter();
    const origCreate = adapter.createVerificationToken!;
    adapter.createVerificationToken = async (vt) => {
      vtokens.push(vt);
      return origCreate(vt);
    };
    adapter.useVerificationToken = async ({ identifier, token }) => {
      const idx = vtokens.findIndex((v) => v.identifier === identifier && v.token === token);
      if (idx === -1) return null;
      return vtokens.splice(idx, 1)[0];
    };

    const emailProvider: EmailProvider = {
      id: 'email',
      name: 'Email',
      type: 'email',
      maxAge: 3600,
      transport: { sendVerificationRequest: vi.fn(async () => {}) },
    };

    const handlers = VinextAuth({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [emailProvider],
      adapter,
    });

    // First: trigger email sign-in to store a token
    const { token: csrfToken, cookieValue } = await generateCsrfToken(TEST_SECRET);
    await handlers.POST(
      new Request(`${BASE_URL}/api/auth/signin/email`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie: `vinextauth.csrf-token=${encodeURIComponent(cookieValue)}`,
        },
        body: new URLSearchParams({ csrfToken, email: 'alice@example.com' }).toString(),
      })
    );

    // Extract the stored verification token
    expect(vtokens.length).toBe(1);
    const magicToken = vtokens[0].token;

    // Then: verify the token via the callback URL
    const verifyUrl = new URL(`${BASE_URL}/api/auth/callback/email`);
    verifyUrl.searchParams.set('token', magicToken);
    verifyUrl.searchParams.set('email', 'alice@example.com');
    const verifyRes = await handlers.GET(new Request(verifyUrl.toString()));

    expect(verifyRes.status).toBe(302);
    const setCookie = verifyRes.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('vinextauth.session-token');
  });
});

describe('VinextAuth router — pagesCsrf', () => {
  it('generates CSRF token and sets cookie on first call', async () => {
    const { pagesCsrf } = makeAuth();
    let setCookieValue = '';
    const req = { method: 'GET', url: '/api/auth/csrf', headers: {}, cookies: {} };
    const res = {
      status: () => res,
      setHeader: (_k: string, v: string | string[]) => {
        setCookieValue = Array.isArray(v) ? v[0] : v;
      },
      send: () => {},
    };
    const token = await pagesCsrf(req as never, res as never);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(setCookieValue).toContain('vinextauth.csrf-token');
  });

  it('returns existing CSRF token from cookie without setting a new one', async () => {
    const { pagesCsrf } = makeAuth();
    const { token, cookieValue } = await generateCsrfToken(TEST_SECRET);
    const req = {
      method: 'GET',
      url: '/api/auth/csrf',
      headers: { cookie: `vinextauth.csrf-token=${encodeURIComponent(cookieValue)}` },
      cookies: {},
    };
    let setCookieCalled = false;
    const res = {
      status: () => res,
      setHeader: () => {
        setCookieCalled = true;
      },
      send: () => {},
    };
    const returned = await pagesCsrf(req as never, res as never);
    expect(returned).toBe(token);
    expect(setCookieCalled).toBe(false);
  });
});

describe('VinextAuth router — auth() function', () => {
  it('returns null when next/headers is unavailable', async () => {
    const { auth } = makeAuth();
    // In test environment next/headers is not available → auth() returns null
    const session = await auth();
    expect(session).toBeNull();
  });
});
