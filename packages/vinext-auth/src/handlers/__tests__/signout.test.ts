import { describe, it, expect } from 'vitest';
import { handleSignOut } from '../signout.js';
import { resolveConfig } from '../../core/config.js';
import { generateCsrfToken } from '../../core/csrf.js';

const TEST_SECRET = 'test-secret-32-chars-long-enough!!';
const BASE_URL = 'http://localhost:3001';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return resolveConfig({
    secret: TEST_SECRET,
    baseUrl: BASE_URL,
    providers: [],
    ...overrides,
  });
}

async function makeSignOutRequest(
  options: {
    body?: Record<string, string>;
    contentType?: string;
    withCsrf?: boolean;
    method?: string;
  } = {}
): Promise<Request> {
  const {
    withCsrf = true,
    method = 'POST',
    contentType = 'application/x-www-form-urlencoded',
  } = options;

  const headers: Record<string, string> = { 'content-type': contentType };
  let body = options.body ?? {};

  if (withCsrf) {
    const { token, cookieValue } = await generateCsrfToken(TEST_SECRET);
    headers['cookie'] = `vinextauth.csrf-token=${encodeURIComponent(cookieValue)}`;
    body = { csrfToken: token, ...body };
  }

  const reqBody =
    contentType === 'application/json'
      ? JSON.stringify(body)
      : new URLSearchParams(body).toString();

  return new Request(`${BASE_URL}/api/auth/signout`, {
    method,
    headers,
    body: method === 'POST' ? reqBody : undefined,
  });
}

describe('handleSignOut', () => {
  it('GET request redirects to baseUrl without CSRF check', async () => {
    const config = makeConfig();
    const req = new Request(`${BASE_URL}/api/auth/signout`, { method: 'GET' });
    const res = await handleSignOut(req, config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(BASE_URL);
  });

  it('POST without CSRF cookie returns 403', async () => {
    const config = makeConfig();
    const req = new Request(`${BASE_URL}/api/auth/signout`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'csrfToken=whatever',
    });
    const res = await handleSignOut(req, config);
    expect(res.status).toBe(403);
  });

  it('POST without csrfToken in body returns 403', async () => {
    const config = makeConfig();
    const { cookieValue } = await generateCsrfToken(TEST_SECRET);
    const req = new Request(`${BASE_URL}/api/auth/signout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `vinextauth.csrf-token=${encodeURIComponent(cookieValue)}`,
      },
      body: 'callbackUrl=/',
    });
    const res = await handleSignOut(req, config);
    expect(res.status).toBe(403);
  });

  it('POST with invalid CSRF token returns 403', async () => {
    const config = makeConfig();
    const { cookieValue } = await generateCsrfToken(TEST_SECRET);
    const req = new Request(`${BASE_URL}/api/auth/signout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `vinextauth.csrf-token=${encodeURIComponent(cookieValue)}`,
      },
      body: 'csrfToken=invalid-token',
    });
    const res = await handleSignOut(req, config);
    expect(res.status).toBe(403);
  });

  it('POST with valid CSRF clears session cookie and redirects', async () => {
    const config = makeConfig();
    const req = await makeSignOutRequest();
    const res = await handleSignOut(req, config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(BASE_URL);

    // Should clear the session token cookie (Max-Age=0)
    const cookies = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
    const sessionCookieCleared = cookies.some(
      (c) => c.includes('vinextauth.session-token') && c.includes('Max-Age=0')
    );
    expect(sessionCookieCleared).toBe(true);
  });

  it('POST redirects to custom callbackUrl (same origin)', async () => {
    const config = makeConfig();
    const req = await makeSignOutRequest({ body: { callbackUrl: `${BASE_URL}/dashboard` } });
    const res = await handleSignOut(req, config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/dashboard');
  });

  it('POST ignores unsafe cross-origin callbackUrl', async () => {
    const config = makeConfig();
    const req = await makeSignOutRequest({
      body: { callbackUrl: 'https://evil.com/steal' },
    });
    const res = await handleSignOut(req, config);
    expect(res.status).toBe(302);
    // Should fall back to the base URL, not the evil redirect
    expect(res.headers.get('location')).not.toContain('evil.com');
  });

  it('deletes database session when strategy is database', async () => {
    const deletedTokens: string[] = [];
    const sessionToken = 'db-session-token-abc';

    const adapter = {
      getSession: async () => null,
      createSession: async (s: { sessionToken: string; userId: string; expires: Date }) => s,
      updateSession: async () => null,
      deleteSession: async (t: string) => {
        deletedTokens.push(t);
      },
    };

    const config = resolveConfig({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [],
      session: { strategy: 'database' },
      adapter,
    });

    const { token, cookieValue } = await generateCsrfToken(TEST_SECRET);
    const req = new Request(`${BASE_URL}/api/auth/signout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: [
          `vinextauth.csrf-token=${encodeURIComponent(cookieValue)}`,
          `vinextauth.session-token=${encodeURIComponent(sessionToken)}`,
        ].join('; '),
      },
      body: `csrfToken=${encodeURIComponent(token)}`,
    });

    const res = await handleSignOut(req, config);
    expect(res.status).toBe(302);
    expect(deletedTokens).toContain(sessionToken);
  });

  it('POST accepts JSON content-type', async () => {
    const config = makeConfig();
    const req = await makeSignOutRequest({ contentType: 'application/json' });
    const res = await handleSignOut(req, config);
    expect(res.status).toBe(302);
  });

  it('fires signOut event after successful sign-out', async () => {
    let signOutFired = false;
    const config = makeConfig({
      events: {
        signOut: async () => {
          signOutFired = true;
        },
      },
    });
    const req = await makeSignOutRequest();
    await handleSignOut(req, config);
    // fire-and-forget — give microtasks a chance to run
    await new Promise((r) => setTimeout(r, 10));
    expect(signOutFired).toBe(true);
  });
});
