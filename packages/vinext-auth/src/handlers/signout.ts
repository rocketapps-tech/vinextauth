import type { ResolvedConfig } from '../types.js';
import { getCsrfCookie, getSessionToken } from '../cookies/index.js';
import { verifyCsrfToken } from '../core/csrf.js';
import { deleteCookieString } from '../cookies/strategy.js';

export async function handleSignOut(request: Request, config: ResolvedConfig): Promise<Response> {
  let callbackUrl: string;

  if (typeof config.baseUrl === 'function') {
    const resolved = await config.baseUrl(request);
    callbackUrl = resolved.startsWith('http') ? resolved : `https://${resolved}`;
  } else {
    callbackUrl = config.baseUrl as string;
  }

  if (request.method === 'POST') {
    let body: Record<string, string> = {};
    try {
      const contentType = request.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        body = (await request.json()) as Record<string, string>;
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await request.text();
        body = Object.fromEntries(new URLSearchParams(text));
      }
    } catch {
      // ignore parse errors
    }

    // Verify CSRF — reject if token missing or invalid
    const csrfCookie = getCsrfCookie(request, config);
    const submittedToken = body.csrfToken ?? '';
    if (!csrfCookie || !submittedToken) {
      return new Response('CSRF token required', { status: 403 });
    }
    const valid = await verifyCsrfToken(submittedToken, csrfCookie, config.secret);
    if (!valid) {
      if (config.debug) console.warn('[VinextAuth] CSRF verification failed on signout');
      return new Response('Invalid CSRF token', { status: 403 });
    }

    if (body.callbackUrl) {
      callbackUrl = sanitizeRedirectUrl(body.callbackUrl, callbackUrl);
    }
  }

  const redirectUrl = callbackUrl.startsWith('/')
    ? `${typeof config.baseUrl === 'string' ? config.baseUrl : ''}${callbackUrl}`
    : callbackUrl;

  const headers = new Headers();

  // ── Delete database session ───────────────────────────────────────────────
  if (config.session.strategy === 'database' && config.adapter?.deleteSession) {
    const token = getSessionToken(request, config);
    if (token) await config.adapter.deleteSession(token);
  }

  // ── Clear ALL vinext-auth cookies — no stale tokens left behind ────────────
  const { sessionToken, callbackUrl: cbCookie, csrfToken, state, nonce } = config.cookies;

  for (const cookie of [sessionToken, cbCookie, csrfToken, state, nonce]) {
    headers.append('Set-Cookie', deleteCookieString(cookie.name, cookie.options));
    // Also clear the non-prefixed variant in case of prefix migration
    const unprefixed = cookie.name.replace('__Secure-', '');
    if (unprefixed !== cookie.name) {
      headers.append(
        'Set-Cookie',
        deleteCookieString(unprefixed, { ...cookie.options, secure: false })
      );
    }
  }

  headers.set('Location', redirectUrl);

  return new Response(null, { status: 302, headers });
}

/** Returns a safe redirect URL restricted to the app's own origin. */
function sanitizeRedirectUrl(url: string, baseUrl: string): string {
  if (url.startsWith('/') && !url.startsWith('//')) {
    return `${baseUrl}${url}`;
  }
  try {
    const redirect = new URL(url);
    const base = new URL(baseUrl);
    if (redirect.origin === base.origin) return url;
  } catch {
    // fall through
  }
  return baseUrl;
}
