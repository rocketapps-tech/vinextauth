import type { ResolvedConfig, SignInCallbackParams } from '../types.js';
import { applySessionCookie } from '../cookies/index.js';
import { buildJWT, encodeSession, generateId } from '../core/session.js';
import { resolveBaseUrl } from '../core/config.js';

/**
 * GET /api/auth/callback/email?token=...&email=...
 *
 * Flow:
 * 1. Extract token + email from query params
 * 2. Call adapter.useVerificationToken() — returns the token if valid, null if expired/used
 * 3. If null → redirect to error page
 * 4. Look up user by email via adapter.getUserByEmail()
 * 5. Run signIn callback
 * 6. Create session (JWT or database strategy)
 * 7. Set session cookie + redirect to callbackUrl
 */
export async function handleEmailVerify(
  request: Request,
  config: ResolvedConfig
): Promise<Response> {
  const baseUrl = await resolveBaseUrl(config, request);
  const url = new URL(request.url);
  const errorBase = `${baseUrl}${config.pages.error}`;

  const token = url.searchParams.get('token');
  const email = url.searchParams.get('email');

  if (!token || !email) {
    return Response.redirect(`${errorBase}?error=Verification`, 302);
  }

  // ── Require adapter with verification token support ───────────────────────
  if (!config.adapter?.useVerificationToken) {
    throw new Error(
      '[VinextAuth] EmailProvider requires an adapter with useVerificationToken support.'
    );
  }

  // ── Consume verification token (one-time use) ─────────────────────────────
  const verificationToken = await config.adapter.useVerificationToken({ identifier: email, token });

  if (!verificationToken) {
    return Response.redirect(`${errorBase}?error=Verification`, 302);
  }

  // Guard against expired tokens (adapter may not enforce this itself)
  if (verificationToken.expires < new Date()) {
    return Response.redirect(`${errorBase}?error=Verification`, 302);
  }

  // ── Resolve user ──────────────────────────────────────────────────────────
  let user = config.adapter.getUserByEmail ? await config.adapter.getUserByEmail(email) : null;

  if (!user) {
    if (config.adapter.createUser) {
      user = await config.adapter.createUser({ name: null, email, image: null });
    } else {
      return Response.redirect(`${errorBase}?error=Verification`, 302);
    }
  }

  const account: SignInCallbackParams['account'] = {
    provider: 'email',
    type: 'oauth', // reuse oauth type for callback compat; email flows have no access_token
    providerAccountId: email,
  };

  // ── signIn callback ───────────────────────────────────────────────────────
  if (config.callbacks.signIn) {
    const result = await config.callbacks.signIn({ user, account });
    if (result === false) {
      return Response.redirect(`${errorBase}?error=AccessDenied`, 302);
    }
    if (typeof result === 'string') {
      return Response.redirect(result, 302);
    }
  }

  const rawCallbackUrl = url.searchParams.get('callbackUrl') ?? config.pages.newUser ?? '/';
  const redirectUrl = sanitizeRedirectUrl(rawCallbackUrl, baseUrl);

  const headers = new Headers();

  // ── Database strategy ─────────────────────────────────────────────────────
  if (config.session.strategy === 'database' && config.adapter.createSession) {
    const sessionToken = generateId();
    const expires = new Date(Date.now() + config.session.maxAge * 1000);
    await config.adapter.createSession({ sessionToken, userId: user.id, expires });
    applySessionCookie(headers, sessionToken, config);
    headers.set('Location', redirectUrl);
    if (config.debug) {
      console.log('[VinextAuth] Email sign-in (DB session) for:', email);
    }
    return new Response(null, { status: 302, headers });
  }

  // ── JWT strategy ──────────────────────────────────────────────────────────
  const jwtPayload = await buildJWT(user, account, {}, config);
  const sessionToken = await encodeSession(jwtPayload, config);

  applySessionCookie(headers, sessionToken, config);
  headers.set('Location', redirectUrl);

  if (config.debug) {
    console.log('[VinextAuth] Email sign-in (JWT session) for:', email);
  }

  return new Response(null, { status: 302, headers });
}

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
