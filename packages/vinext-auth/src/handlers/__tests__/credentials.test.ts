import { describe, it, expect } from 'vitest';
import { handleCredentials } from '../credentials.js';
import { resolveConfig } from '../../core/config.js';
import { generateCsrfToken } from '../../core/csrf.js';
import type { CredentialsProvider } from '../../types.js';

const TEST_SECRET = 'test-secret-32-chars-long-enough!!';
const BASE_URL = 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProvider(
  authorize: CredentialsProvider['authorize'] = async ({ username, password }) => {
    if (username === 'alice' && password === 'pass123') {
      return { id: 'user-1', name: 'Alice', email: 'alice@example.com', image: null };
    }
    return null;
  }
): CredentialsProvider {
  return {
    id: 'credentials',
    name: 'Credentials',
    type: 'credentials',
    credentials: { username: {}, password: {} },
    authorize,
  };
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  const provider = makeProvider();
  return resolveConfig({
    secret: TEST_SECRET,
    baseUrl: BASE_URL,
    providers: [provider],
    ...overrides,
  });
}

async function makePostRequest(
  body: Record<string, string>,
  options: { contentType?: string; ip?: string } = {}
): Promise<Request> {
  const { token, cookieValue } = await generateCsrfToken(TEST_SECRET);
  const config = makeConfig();
  const csrfCookieName = config.cookies.csrfToken.name; // vinextauth.csrf-token

  const fullBody = { csrfToken: token, ...body };
  const contentType = options.contentType ?? 'application/x-www-form-urlencoded';

  const headers: Record<string, string> = {
    'content-type': contentType,
    cookie: `${csrfCookieName}=${encodeURIComponent(cookieValue)}`,
  };
  if (options.ip) {
    headers['x-forwarded-for'] = options.ip;
  }

  const reqBody =
    contentType === 'application/json'
      ? JSON.stringify(fullBody)
      : new URLSearchParams(fullBody).toString();

  return new Request(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers,
    body: reqBody,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleCredentials', () => {
  it('rejects non-POST requests', async () => {
    const config = makeConfig();
    const req = new Request(`${BASE_URL}/api/auth/callback/credentials`, { method: 'GET' });
    const res = await handleCredentials(req, makeProvider(), config);
    expect(res.status).toBe(405);
  });

  it('rejects when CSRF cookie is missing', async () => {
    const config = makeConfig();
    const req = new Request(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'csrfToken=sometoken',
    });
    const res = await handleCredentials(req, makeProvider(), config);
    expect(res.status).toBe(403);
  });

  it('rejects when CSRF token is missing from body', async () => {
    const config = makeConfig();
    const { cookieValue } = await generateCsrfToken(TEST_SECRET);
    const req = new Request(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `vinextauth.csrf-token=${encodeURIComponent(cookieValue)}`,
      },
      body: 'username=alice&password=pass123',
    });
    const res = await handleCredentials(req, makeProvider(), config);
    expect(res.status).toBe(403);
  });

  it('rejects an invalid CSRF token', async () => {
    const config = makeConfig();
    const { cookieValue } = await generateCsrfToken(TEST_SECRET);
    const req = new Request(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: `vinextauth.csrf-token=${encodeURIComponent(cookieValue)}`,
      },
      body: 'csrfToken=wrongtoken&username=alice&password=pass123',
    });
    const res = await handleCredentials(req, makeProvider(), config);
    expect(res.status).toBe(403);
  });

  it('signs in successfully with valid credentials (form-urlencoded)', async () => {
    const config = makeConfig();
    const req = await makePostRequest({ username: 'alice', password: 'pass123' });
    const res = await handleCredentials(req, makeProvider(), config);
    expect(res.status).toBe(302);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('vinextauth.session-token');
  });

  it('signs in successfully with valid credentials (JSON body)', async () => {
    const config = makeConfig();
    const req = await makePostRequest(
      { username: 'alice', password: 'pass123' },
      { contentType: 'application/json' }
    );
    const res = await handleCredentials(req, makeProvider(), config);
    expect(res.status).toBe(302);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('vinextauth.session-token');
  });

  it('redirects to InvalidCredentials when authorize() returns null', async () => {
    const config = makeConfig();
    const req = await makePostRequest({ username: 'alice', password: 'wrong' });
    const res = await handleCredentials(req, makeProvider(), config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('InvalidCredentials');
  });

  it('redirects to error page when authorize() throws', async () => {
    const config = makeConfig();
    const throwingProvider = makeProvider(async () => {
      throw new Error('DB exploded');
    });
    const req = await makePostRequest({ username: 'alice', password: 'pass123' });
    const res = await handleCredentials(req, throwingProvider, config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('InvalidCredentials');
  });

  it('redirects to RateLimitExceeded after maxAttempts', async () => {
    const config = resolveConfig({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [makeProvider()],
      credentials: { rateLimit: { maxAttempts: 2, windowMs: 60_000 } },
    });

    // Use a unique IP to avoid cross-test pollution
    const ip = `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    // First two attempts with wrong password
    for (let i = 0; i < 2; i++) {
      const req = await makePostRequest({ username: 'alice', password: 'wrong' }, { ip });
      await handleCredentials(req, makeProvider(), config);
    }

    // Third attempt — should be rate limited
    const req = await makePostRequest({ username: 'alice', password: 'pass123' }, { ip });
    const res = await handleCredentials(req, makeProvider(), config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('RateLimitExceeded');
  });

  it('redirects to AccessDenied when signIn callback returns false', async () => {
    const config = makeConfig({
      callbacks: { signIn: () => false },
    });
    const req = await makePostRequest({ username: 'alice', password: 'pass123' });
    const res = await handleCredentials(req, makeProvider(), config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('AccessDenied');
  });

  it('redirects to custom URL when signIn callback returns a string', async () => {
    const config = makeConfig({
      callbacks: { signIn: () => `${BASE_URL}/custom-redirect` },
    });
    const req = await makePostRequest({ username: 'alice', password: 'pass123' });
    const res = await handleCredentials(req, makeProvider(), config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('custom-redirect');
  });

  it('creates database session when strategy is database', async () => {
    const sessions: Array<{ sessionToken: string; userId: string; expires: Date }> = [];
    const adapter = {
      createSession: async (s: { sessionToken: string; userId: string; expires: Date }) => {
        sessions.push(s);
        return s;
      },
      getSession: async () => null,
      updateSession: async () => null,
      deleteSession: async () => undefined,
    };

    const config = resolveConfig({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [makeProvider()],
      session: { strategy: 'database' },
      adapter,
    });

    const req = await makePostRequest({ username: 'alice', password: 'pass123' });
    const res = await handleCredentials(req, makeProvider(), config);
    expect(res.status).toBe(302);
    expect(sessions.length).toBe(1);
    expect(sessions[0].userId).toBe('user-1');
  });
});
