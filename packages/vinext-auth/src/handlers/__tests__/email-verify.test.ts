import { describe, it, expect } from 'vitest';
import { handleEmailVerify } from '../email-verify.js';
import { resolveConfig } from '../../core/config.js';
import type { AdapterInterface } from '../../types.js';

const TEST_SECRET = 'test-secret-32-chars-long-enough!!';
const BASE_URL = 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_USER = { id: 'user-1', name: 'Alice', email: 'alice@example.com', image: null };

function makeAdapter(overrides: Partial<AdapterInterface> = {}): AdapterInterface {
  return {
    getSession: async () => null,
    createSession: async (s) => s,
    updateSession: async () => null,
    deleteSession: async () => undefined,
    getUserByEmail: async (email) => (email === VALID_USER.email ? VALID_USER : null),
    useVerificationToken: async ({ identifier, token }) => {
      if (identifier === 'alice@example.com' && token === 'valid-token') {
        return {
          identifier,
          token,
          expires: new Date(Date.now() + 3600 * 1000),
        };
      }
      return null;
    },
    ...overrides,
  };
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return resolveConfig({
    secret: TEST_SECRET,
    baseUrl: BASE_URL,
    providers: [],
    adapter: makeAdapter(),
    ...overrides,
  });
}

function makeVerifyRequest(params: Record<string, string> = {}): Request {
  const url = new URL(`${BASE_URL}/api/auth/callback/email`);
  const defaults = { token: 'valid-token', email: 'alice@example.com' };
  for (const [k, v] of Object.entries({ ...defaults, ...params })) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleEmailVerify', () => {
  it('redirects to Verification error when token param is missing', async () => {
    const config = makeConfig();
    const url = new URL(`${BASE_URL}/api/auth/callback/email`);
    url.searchParams.set('email', 'alice@example.com');
    // no token
    const res = await handleEmailVerify(new Request(url.toString()), config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('Verification');
  });

  it('redirects to Verification error when email param is missing', async () => {
    const config = makeConfig();
    const url = new URL(`${BASE_URL}/api/auth/callback/email`);
    url.searchParams.set('token', 'some-token');
    // no email
    const res = await handleEmailVerify(new Request(url.toString()), config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('Verification');
  });

  it('throws when adapter lacks useVerificationToken', async () => {
    const config = resolveConfig({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [],
      adapter: {
        getSession: async () => null,
        createSession: async (s) => s,
        updateSession: async () => null,
        deleteSession: async () => undefined,
        // no useVerificationToken
      },
    });
    await expect(handleEmailVerify(makeVerifyRequest(), config)).rejects.toThrow(
      /useVerificationToken/
    );
  });

  it('redirects to Verification error when token is invalid/used', async () => {
    const config = makeConfig();
    const req = makeVerifyRequest({ token: 'nonexistent-token' });
    const res = await handleEmailVerify(req, config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('Verification');
  });

  it('redirects to Verification error when token is expired', async () => {
    const config = makeConfig({
      adapter: makeAdapter({
        useVerificationToken: async () => ({
          identifier: 'alice@example.com',
          token: 'valid-token',
          expires: new Date(Date.now() - 1000), // expired
        }),
      }),
    });
    const res = await handleEmailVerify(makeVerifyRequest(), config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('Verification');
  });

  it('creates a JWT session and redirects on success', async () => {
    const config = makeConfig();
    const res = await handleEmailVerify(makeVerifyRequest(), config);
    expect(res.status).toBe(302);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('vinextauth.session-token');
  });

  it('creates user when getUserByEmail returns null and createUser is available', async () => {
    const createdUsers: string[] = [];
    const config = makeConfig({
      adapter: makeAdapter({
        getUserByEmail: async () => null,
        createUser: async (user) => {
          createdUsers.push(user.email!);
          return { id: 'new-user', name: null, email: user.email ?? null, image: null };
        },
      }),
    });
    const res = await handleEmailVerify(makeVerifyRequest(), config);
    expect(res.status).toBe(302);
    expect(createdUsers).toContain('alice@example.com');
  });

  it('redirects to Verification error when no user and no createUser', async () => {
    const config = makeConfig({
      adapter: makeAdapter({
        getUserByEmail: async () => null,
        createUser: undefined,
      }),
    });
    const res = await handleEmailVerify(makeVerifyRequest(), config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('Verification');
  });

  it('redirects to AccessDenied when signIn callback returns false', async () => {
    const config = makeConfig({
      callbacks: { signIn: () => false },
    });
    const res = await handleEmailVerify(makeVerifyRequest(), config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('AccessDenied');
  });

  it('redirects to custom URL when signIn callback returns a string', async () => {
    const config = makeConfig({
      callbacks: { signIn: () => `${BASE_URL}/custom` },
    });
    const res = await handleEmailVerify(makeVerifyRequest(), config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/custom');
  });

  it('creates database session when strategy is database', async () => {
    const sessions: Array<{ sessionToken: string; userId: string }> = [];
    const config = makeConfig({
      session: { strategy: 'database' },
      adapter: makeAdapter({
        createSession: async (s) => {
          sessions.push({ sessionToken: s.sessionToken, userId: s.userId });
          return s;
        },
      }),
    });
    const res = await handleEmailVerify(makeVerifyRequest(), config);
    expect(res.status).toBe(302);
    expect(sessions.length).toBe(1);
    expect(sessions[0].userId).toBe(VALID_USER.id);
  });

  it('redirects to callbackUrl from query param', async () => {
    const config = makeConfig();
    const req = makeVerifyRequest({ callbackUrl: `${BASE_URL}/dashboard` });
    const res = await handleEmailVerify(req, config);
    expect(res.headers.get('location')).toContain('/dashboard');
  });

  it('falls back to base URL for unsafe cross-origin callbackUrl', async () => {
    const config = makeConfig();
    const req = makeVerifyRequest({ callbackUrl: 'https://evil.com/steal' });
    const res = await handleEmailVerify(req, config);
    expect(res.headers.get('location')).not.toContain('evil.com');
  });
});
