import { describe, it, expect } from 'vitest';
import { handleSessionRoute } from '../session-route.js';
import { resolveConfig } from '../../core/config.js';
import { sign } from '../../jwt/index.js';
import type { DefaultSession } from '../../types.js';

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

async function signToken(payload: Record<string, unknown> = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      picture: null,
      iat: now,
      exp: now + 3600,
      jti: 'test-jti',
      ...payload,
    },
    TEST_SECRET
  );
}

function makeRequest(token?: string): Request {
  const headers: Record<string, string> = {
    'cache-control': 'no-cache',
  };
  if (token) {
    headers['cookie'] = `vinextauth.session-token=${encodeURIComponent(token)}`;
  }
  return new Request(`${BASE_URL}/api/auth/session`, { headers });
}

describe('handleSessionRoute', () => {
  it('returns empty object when no session cookie', async () => {
    const config = makeConfig();
    const req = makeRequest();
    const res = await handleSessionRoute(req, config);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it('returns empty object for an invalid token', async () => {
    const config = makeConfig();
    const req = makeRequest('invalid.token.value');
    const res = await handleSessionRoute(req, config);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it('returns empty object for an expired token', async () => {
    const config = makeConfig();
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      { sub: 'user-1', iat: now - 7200, exp: now - 3600, jti: 'x' },
      TEST_SECRET
    );
    const req = makeRequest(token);
    const res = await handleSessionRoute(req, config);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });

  it('returns session data for a valid token', async () => {
    const config = makeConfig();
    const token = await signToken();
    const req = makeRequest(token);
    const res = await handleSessionRoute(req, config);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.user as Record<string, unknown>)?.email).toBe('alice@example.com');
    expect((body.user as Record<string, unknown>)?.name).toBe('Alice');
    expect(typeof body.expires).toBe('string');
  });

  it('includes Cache-Control: no-store header', async () => {
    const config = makeConfig();
    const req = makeRequest();
    const res = await handleSessionRoute(req, config);
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
  });

  it('applies session callback to the response', async () => {
    const config = makeConfig({
      callbacks: {
        session({ session }: { session: DefaultSession }) {
          return { ...session, user: { ...session.user, role: 'admin' } };
        },
      },
    });
    const token = await signToken();
    const req = makeRequest(token);
    const res = await handleSessionRoute(req, config);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.user as Record<string, unknown>)?.role).toBe('admin');
  });

  it('fires session event (fire-and-forget)', async () => {
    let sessionEventFired = false;
    const config = makeConfig({
      events: {
        session: async () => {
          sessionEventFired = true;
        },
      },
    });
    const token = await signToken();
    const req = makeRequest(token);
    await handleSessionRoute(req, config);
    await new Promise((r) => setTimeout(r, 10));
    expect(sessionEventFired).toBe(true);
  });

  it('returns database session when strategy is database', async () => {
    const sessionToken = 'db-session-abc';
    const expires = new Date(Date.now() + 3600 * 1000);

    const adapter = {
      getSession: async (token: string) => {
        if (token === sessionToken) {
          return {
            sessionToken,
            userId: 'user-db-1',
            expires,
            user: { id: 'user-db-1', name: 'Bob', email: 'bob@example.com', image: null },
          };
        }
        return null;
      },
      createSession: async (s: { sessionToken: string; userId: string; expires: Date }) => s,
      updateSession: async () => null,
      deleteSession: async () => undefined,
    };

    const config = resolveConfig({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [],
      session: { strategy: 'database' },
      adapter,
    });

    const req = new Request(`${BASE_URL}/api/auth/session`, {
      headers: {
        cookie: `vinextauth.session-token=${encodeURIComponent(sessionToken)}`,
      },
    });

    const res = await handleSessionRoute(req, config);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.user as Record<string, unknown>)?.email).toBe('bob@example.com');
  });

  it('returns empty object when database session not found', async () => {
    const adapter = {
      getSession: async () => null,
      createSession: async (s: { sessionToken: string; userId: string; expires: Date }) => s,
      updateSession: async () => null,
      deleteSession: async () => undefined,
    };

    const config = resolveConfig({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [],
      session: { strategy: 'database' },
      adapter,
    });

    const req = new Request(`${BASE_URL}/api/auth/session`, {
      headers: { cookie: 'vinextauth.session-token=nonexistent-token' },
    });

    const res = await handleSessionRoute(req, config);
    expect(await res.json()).toEqual({});
  });
});
