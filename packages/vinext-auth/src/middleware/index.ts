import type { WithAuthOptions, JWT } from '../types.js';
import * as jwtLib from '../jwt/index.js';
import { SESSION_TOKEN_COOKIE } from '../cookies/strategy.js';

type NextRequest = Request & {
  cookies?: { get?: (name: string) => { value: string } | undefined };
  nextUrl?: URL;
};

type NextMiddlewareResult = Response | null | undefined;
type NextMiddleware = (
  request: NextRequest
) => NextMiddlewareResult | Promise<NextMiddlewareResult>;

function getNextResponse() {
  // Compatibility: return a simple redirect builder
  return {
    redirect: (url: string | URL, status = 302) =>
      new Response(null, { status, headers: { Location: url.toString() } }),
    next: () => undefined as NextMiddlewareResult,
  };
}

/**
 * withAuth — Edge-compatible middleware, drop-in for NextAuth's withAuth.
 *
 * Usage (identical to NextAuth v4):
 * ```ts
 * export default withAuth({ pages: { signIn: "/login" } })
 * export const config = { matcher: ["/dashboard/:path*"] }
 * ```
 */
export function withAuth(
  middlewareOrOptions?: NextMiddleware | WithAuthOptions,
  options?: WithAuthOptions
): NextMiddleware {
  let innerMiddleware: NextMiddleware | undefined;
  let opts: WithAuthOptions;

  if (typeof middlewareOrOptions === 'function') {
    innerMiddleware = middlewareOrOptions;
    opts = options ?? {};
  } else {
    opts = middlewareOrOptions ?? {};
  }

  const signInPage = opts.pages?.signIn ?? '/api/auth/signin';

  return async (request: NextRequest): Promise<NextMiddlewareResult> => {
    const secret =
      opts.secret ?? (typeof process !== 'undefined' ? process.env.VINEXTAUTH_SECRET : undefined);

    if (!secret) {
      console.error('[VinextAuth] withAuth: No secret configured.');
      return getNextResponse().redirect(signInPage);
    }

    const token = getTokenFromRequest(request);
    let jwt: JWT | null = null;

    if (token) {
      jwt = await jwtLib.verify(token, secret);
    }

    // Custom authorized callback
    if (opts.callbacks?.authorized) {
      const authorized = await opts.callbacks.authorized({ token: jwt, req: request });
      if (!authorized) {
        return redirectToSignIn(request, signInPage);
      }
    } else {
      // Default: just require a valid token
      if (!jwt) {
        return redirectToSignIn(request, signInPage);
      }
    }

    // Pass through to inner middleware if provided
    if (innerMiddleware) {
      return innerMiddleware(request);
    }

    return getNextResponse().next();
  };
}

function getTokenFromRequest(request: NextRequest): string | null {
  // Try next.js cookies API (NextRequest)
  if (request.cookies?.get) {
    const secure = request.cookies.get(`__Secure-${SESSION_TOKEN_COOKIE}`)?.value;
    if (secure) return secure;
    const plain = request.cookies.get(SESSION_TOKEN_COOKIE)?.value;
    if (plain) return plain;
  }

  // Fallback: parse Cookie header manually
  const cookieHeader = request.headers.get('cookie') ?? '';
  for (const part of cookieHeader.split(';')) {
    const [key, ...val] = part.trim().split('=');
    const name = key.trim();
    if (name === `__Secure-${SESSION_TOKEN_COOKIE}` || name === SESSION_TOKEN_COOKIE) {
      return decodeURIComponent(val.join('='));
    }
  }

  return null;
}

function redirectToSignIn(request: NextRequest, signInPage: string): Response {
  const url = request.nextUrl ?? new URL(request.url);
  const callbackUrl = url.pathname + url.search;
  const redirectUrl = `${signInPage}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl },
  });
}

export default withAuth;
