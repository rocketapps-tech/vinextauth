import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleCallback } from '../callback.js';
import { resolveConfig } from '../../core/config.js';
import type { OAuthProvider } from '../../types.js';

const TEST_SECRET = 'test-secret-32-chars-long-enough!!';
const BASE_URL = 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGithubProvider(overrides: Partial<OAuthProvider> = {}): OAuthProvider {
  return {
    id: 'github',
    name: 'GitHub',
    type: 'oauth',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    authorization: { url: 'https://github.com/login/oauth/authorize', params: {} },
    token: { url: 'https://github.com/login/oauth/access_token' },
    userinfo: { url: 'https://api.github.com/user' },
    profile(profile) {
      return {
        id: String(profile.id),
        name: profile.name as string | null,
        email: profile.email as string | null,
        image: profile.avatar_url as string | null,
      };
    },
    checks: ['state'],
    ...overrides,
  };
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return resolveConfig({
    secret: TEST_SECRET,
    baseUrl: BASE_URL,
    providers: [makeGithubProvider()],
    ...overrides,
  });
}

function makeCallbackRequest(
  params: { code?: string; state?: string; error?: string } = {},
  cookieOverrides: Record<string, string> = {}
): Request {
  const url = new URL(`${BASE_URL}/api/auth/callback/github`);
  if (params.code) url.searchParams.set('code', params.code);
  if (params.state) url.searchParams.set('state', params.state);
  if (params.error) url.searchParams.set('error', params.error);

  const defaultState = params.state ?? 'test-state-value';
  const cookieParts = [
    `vinextauth.state=${encodeURIComponent(defaultState)}`,
    ...Object.entries(cookieOverrides).map(([k, v]) => `${k}=${encodeURIComponent(v)}`),
  ];

  return new Request(url.toString(), {
    headers: { cookie: cookieParts.join('; ') },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleCallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 404 for an unknown provider', async () => {
    const config = makeConfig();
    const req = new Request(`${BASE_URL}/api/auth/callback/unknown`);
    const res = await handleCallback(req, 'unknown', config);
    expect(res.status).toBe(404);
  });

  it('redirects to error page when OAuth error param is present', async () => {
    const config = makeConfig();
    const req = makeCallbackRequest({ error: 'access_denied' });
    const res = await handleCallback(req, 'github', config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=access_denied');
  });

  it('returns 400 when code is missing', async () => {
    const config = makeConfig();
    // state matches cookie but no code
    const req = makeCallbackRequest({ state: 'test-state-value' });
    const res = await handleCallback(req, 'github', config);
    expect(res.status).toBe(400);
  });

  it('redirects to OAuthStateError when state is missing from cookie', async () => {
    const config = makeConfig();
    const url = new URL(`${BASE_URL}/api/auth/callback/github`);
    url.searchParams.set('code', 'auth-code');
    url.searchParams.set('state', 'some-state');
    // No state cookie
    const req = new Request(url.toString());
    const res = await handleCallback(req, 'github', config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('OAuthStateError');
  });

  it('redirects to OAuthStateError when state does not match cookie', async () => {
    const config = makeConfig();
    const url = new URL(`${BASE_URL}/api/auth/callback/github`);
    url.searchParams.set('code', 'auth-code');
    url.searchParams.set('state', 'wrong-state');
    const req = new Request(url.toString(), {
      headers: { cookie: `vinextauth.state=${encodeURIComponent('correct-state')}` },
    });
    const res = await handleCallback(req, 'github', config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('OAuthStateError');
  });

  it('redirects to OAuthCallbackError when token exchange fails', async () => {
    const config = makeConfig();
    vi.mocked(fetch).mockResolvedValue(new Response('Bad Request', { status: 400 }));

    const req = makeCallbackRequest({ code: 'auth-code', state: 'test-state-value' });
    const res = await handleCallback(req, 'github', config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('OAuthCallbackError');
  });

  it('redirects to OAuthCallbackError when userinfo fetch fails', async () => {
    const config = makeConfig();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'tok', token_type: 'bearer' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const req = makeCallbackRequest({ code: 'auth-code', state: 'test-state-value' });
    const res = await handleCallback(req, 'github', config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('OAuthCallbackError');
  });

  it('creates a JWT session and redirects on successful sign-in', async () => {
    const config = makeConfig();
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-abc', token_type: 'bearer' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 42, name: 'Alice', email: 'alice@github.com', avatar_url: null }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );

    const req = makeCallbackRequest({ code: 'auth-code', state: 'test-state-value' });
    const res = await handleCallback(req, 'github', config);
    expect(res.status).toBe(302);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('vinextauth.session-token');
    expect(res.headers.get('location')).toMatch(new RegExp(`^${BASE_URL}/?$`));
  });

  it('redirects to AccessDenied when signIn callback returns false', async () => {
    const config = makeConfig({
      callbacks: {
        signIn: () => false,
      },
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'tok', token_type: 'bearer' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 1, name: 'Bob', email: 'bob@example.com', avatar_url: null }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      );

    const req = makeCallbackRequest({ code: 'auth-code', state: 'test-state-value' });
    const res = await handleCallback(req, 'github', config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('AccessDenied');
  });

  it('skips state check for providers with checks: ["none"]', async () => {
    const provider = makeGithubProvider({ checks: ['none'] });
    const config = resolveConfig({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [provider],
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'tok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 1, name: 'Carol', email: 'carol@example.com', avatar_url: null }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      );

    // No state cookie, no state param — should not fail state check
    const url = new URL(`${BASE_URL}/api/auth/callback/github`);
    url.searchParams.set('code', 'some-code');
    const req = new Request(url.toString());
    const res = await handleCallback(req, 'github', config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).not.toContain('OAuthStateError');
  });

  it('uses clientSecretFactory when provider has one', async () => {
    const dynamicSecret = 'dynamic-jwt-secret';
    const provider = makeGithubProvider({
      clientSecret: '',
      clientSecretFactory: async () => dynamicSecret,
    });
    const config = resolveConfig({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [provider],
    });

    let capturedBody = '';
    vi.mocked(fetch)
      .mockImplementationOnce(async (_, init) => {
        capturedBody = (init?.body as string) ?? '';
        return new Response(JSON.stringify({ access_token: 'tok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      })
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 1, name: 'Dave', email: 'dave@example.com', avatar_url: null }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      );

    const req = makeCallbackRequest({ code: 'auth-code', state: 'test-state-value' });
    await handleCallback(req, 'github', config);
    expect(capturedBody).toContain(encodeURIComponent(dynamicSecret));
  });
});
