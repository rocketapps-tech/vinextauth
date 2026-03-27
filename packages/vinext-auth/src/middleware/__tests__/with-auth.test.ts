import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withAuth } from '../index.js';
import { sign } from '../../jwt/index.js';

const TEST_SECRET = 'test-secret-32-chars-long-enough!!';
const BASE_URL = 'http://localhost:3001';
const FAR_FUTURE = Math.floor(Date.now() / 1000) + 86400;

async function signToken(payload: Record<string, unknown> = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: 'user-1',
      email: 'alice@example.com',
      iat: now,
      exp: FAR_FUTURE,
      jti: 'test-jti',
      ...payload,
    },
    TEST_SECRET
  );
}

function makeRequest(token?: string, url = `${BASE_URL}/dashboard`): Request {
  const headers: Record<string, string> = {};
  if (token) {
    headers['cookie'] = `vinextauth.session-token=${encodeURIComponent(token)}`;
  }
  return new Request(url, { headers });
}

describe('withAuth', () => {
  beforeEach(() => {
    vi.stubEnv('VINEXTAUTH_SECRET', TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('passes through requests with a valid session token', async () => {
    const middleware = withAuth({ secret: TEST_SECRET });
    const token = await signToken();
    const req = makeRequest(token);
    const result = await middleware(req);
    // undefined means "pass through" (next())
    expect(result).toBeUndefined();
  });

  it('redirects to sign-in page when token is missing', async () => {
    const middleware = withAuth({ secret: TEST_SECRET });
    const req = makeRequest(); // no token
    const result = await middleware(req);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get('location')).toContain('/api/auth/signin');
  });

  it('redirects to sign-in page when token is expired', async () => {
    const middleware = withAuth({ secret: TEST_SECRET });
    const now = Math.floor(Date.now() / 1000);
    const token = await sign(
      { sub: 'user-1', iat: now - 7200, exp: now - 3600, jti: 'x' },
      TEST_SECRET
    );
    const req = makeRequest(token);
    const result = await middleware(req);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
  });

  it('redirects to sign-in page when token is invalid', async () => {
    const middleware = withAuth({ secret: TEST_SECRET });
    const req = makeRequest('not.a.valid.token');
    const result = await middleware(req);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
  });

  it('includes callbackUrl in the redirect', async () => {
    const middleware = withAuth({ secret: TEST_SECRET });
    const req = makeRequest(undefined, `${BASE_URL}/protected/page?foo=bar`);
    const result = (await middleware(req)) as Response;
    const location = result.headers.get('location') ?? '';
    expect(location).toContain('callbackUrl');
    expect(location).toContain(encodeURIComponent('/protected/page'));
  });

  it('uses custom signIn page from options', async () => {
    const middleware = withAuth({ secret: TEST_SECRET, pages: { signIn: '/login' } });
    const req = makeRequest();
    const result = (await middleware(req)) as Response;
    expect(result.headers.get('location')).toContain('/login');
  });

  it('calls authorized() callback and respects return value (true = allow)', async () => {
    const middleware = withAuth({
      secret: TEST_SECRET,
      callbacks: {
        authorized: ({ token }) => token !== null,
      },
    });
    const token = await signToken();
    const req = makeRequest(token);
    const result = await middleware(req);
    expect(result).toBeUndefined();
  });

  it('calls authorized() callback and respects return value (false = deny)', async () => {
    const middleware = withAuth({
      secret: TEST_SECRET,
      callbacks: {
        authorized: () => false,
      },
    });
    const token = await signToken();
    const req = makeRequest(token);
    const result = await middleware(req);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
  });

  it('authorized() callback receives the decoded JWT token', async () => {
    let receivedToken: unknown = undefined;
    const middleware = withAuth({
      secret: TEST_SECRET,
      callbacks: {
        authorized: ({ token }) => {
          receivedToken = token;
          return true;
        },
      },
    });
    const jwtToken = await signToken();
    await middleware(makeRequest(jwtToken));
    expect(receivedToken).not.toBeNull();
    expect((receivedToken as Record<string, unknown>)?.email).toBe('alice@example.com');
  });

  it('authorized() receives null token when request is unauthenticated', async () => {
    let receivedToken: unknown = 'not-set';
    const middleware = withAuth({
      secret: TEST_SECRET,
      callbacks: {
        authorized: ({ token }) => {
          receivedToken = token;
          return true; // allow anyway
        },
      },
    });
    await middleware(makeRequest()); // no token
    expect(receivedToken).toBeNull();
  });

  it('passes through to inner middleware when authorized', async () => {
    const innerResult = new Response('from inner', { status: 200 });
    const innerMiddleware = vi.fn(async () => innerResult);
    const middleware = withAuth(innerMiddleware, { secret: TEST_SECRET });
    const token = await signToken();
    const result = await middleware(makeRequest(token));
    expect(innerMiddleware).toHaveBeenCalledOnce();
    expect(result).toBe(innerResult);
  });

  it('does not call inner middleware when unauthorized', async () => {
    const innerMiddleware = vi.fn(async () => new Response('inner'));
    const middleware = withAuth(innerMiddleware, { secret: TEST_SECRET });
    await middleware(makeRequest()); // no token
    expect(innerMiddleware).not.toHaveBeenCalled();
  });

  it('reads token from __Secure- prefixed cookie', async () => {
    const middleware = withAuth({ secret: TEST_SECRET });
    const token = await signToken();
    const req = new Request(`${BASE_URL}/dashboard`, {
      headers: {
        cookie: `__Secure-vinextauth.session-token=${encodeURIComponent(token)}`,
      },
    });
    const result = await middleware(req);
    expect(result).toBeUndefined(); // allowed through
  });

  it('reads token from NextRequest.cookies.get() API', async () => {
    const middleware = withAuth({ secret: TEST_SECRET });
    const token = await signToken();
    // Simulate NextRequest with cookies.get() method
    const req = Object.assign(new Request(`${BASE_URL}/dashboard`), {
      cookies: {
        get: (name: string) => {
          if (name === 'vinextauth.session-token') return { value: token };
          return undefined;
        },
      },
    });
    const result = await middleware(req);
    expect(result).toBeUndefined();
  });

  it('redirects to sign-in when no secret is configured', async () => {
    vi.unstubAllEnvs();
    // withAuth without secret and no env var
    const middleware = withAuth({}); // no secret, env cleared
    const req = makeRequest();
    const result = await middleware(req);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
  });
});
