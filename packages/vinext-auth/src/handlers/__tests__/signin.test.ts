import { describe, it, expect } from 'vitest';
import { handleSignIn } from '../signin.js';
import { resolveConfig } from '../../core/config.js';
import type { OAuthProvider } from '../../types.js';

const TEST_SECRET = 'test-secret-32-chars-long-enough!!';
const BASE_URL = 'http://localhost:3001';

function makeGithubProvider(overrides: Partial<OAuthProvider> = {}): OAuthProvider {
  return {
    id: 'github',
    name: 'GitHub',
    type: 'oauth',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    authorization: {
      url: 'https://github.com/login/oauth/authorize',
      params: { scope: 'read:user user:email' },
    },
    token: { url: 'https://github.com/login/oauth/access_token' },
    userinfo: { url: 'https://api.github.com/user' },
    profile(p) {
      return {
        id: String(p.id),
        name: p.name as string | null,
        email: p.email as string | null,
        image: null,
      };
    },
    checks: ['state'],
    ...overrides,
  };
}

function makeConfig(providers: OAuthProvider[] = [makeGithubProvider()]) {
  return resolveConfig({ secret: TEST_SECRET, baseUrl: BASE_URL, providers });
}

function makeSignInRequest(providerId: string, params: Record<string, string> = {}): Request {
  const url = new URL(`${BASE_URL}/api/auth/signin/${providerId}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

describe('handleSignIn', () => {
  it('returns 404 for unknown provider', async () => {
    const config = makeConfig();
    const req = makeSignInRequest('unknown');
    const res = await handleSignIn(req, 'unknown', config);
    expect(res.status).toBe(404);
  });

  it('redirects to provider authorization URL', async () => {
    const config = makeConfig();
    const req = makeSignInRequest('github');
    const res = await handleSignIn(req, 'github', config);
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('github.com/login/oauth/authorize');
  });

  it('includes client_id and redirect_uri in the authorization URL', async () => {
    const config = makeConfig();
    const req = makeSignInRequest('github');
    const res = await handleSignIn(req, 'github', config);
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.searchParams.get('client_id')).toBe('client-id');
    expect(location.searchParams.get('redirect_uri')).toContain('/callback/github');
  });

  it('sets state cookie and includes state in URL', async () => {
    const config = makeConfig();
    const req = makeSignInRequest('github');
    const res = await handleSignIn(req, 'github', config);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('vinextauth.state');
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.searchParams.get('state')).toBeTruthy();
  });

  it('includes provider params (scope) in the authorization URL', async () => {
    const config = makeConfig();
    const req = makeSignInRequest('github');
    const res = await handleSignIn(req, 'github', config);
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.searchParams.get('scope')).toBe('read:user user:email');
  });

  it('sets callbackUrl cookie from query param', async () => {
    const config = makeConfig();
    const req = makeSignInRequest('github', { callbackUrl: '/dashboard' });
    const res = await handleSignIn(req, 'github', config);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('vinextauth.callback-url');
  });

  it('generates PKCE code_challenge for providers with pkce check', async () => {
    const provider = makeGithubProvider({ checks: ['pkce', 'state'] });
    const config = makeConfig([provider]);
    const req = makeSignInRequest('github');
    const res = await handleSignIn(req, 'github', config);
    const location = new URL(res.headers.get('location') ?? '');
    expect(location.searchParams.get('code_challenge')).toBeTruthy();
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    // PKCE cookie should also be set
    const setCookieHeaders = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
    const hasPkceCookie = setCookieHeaders.some((c) => c.includes('vinextauth.pkce'));
    expect(hasPkceCookie).toBe(true);
  });
});
