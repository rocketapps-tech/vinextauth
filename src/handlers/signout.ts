import type { ResolvedConfig } from "../types.js";
import { getCsrfCookie } from "../cookies/index.js";
import { verifyCsrfToken } from "../core/csrf.js";
import { deleteCookieString } from "../cookies/strategy.js";

export async function handleSignOut(
  request: Request,
  config: ResolvedConfig
): Promise<Response> {
  let callbackUrl: string;

  if (typeof config.baseUrl === "function") {
    const resolved = await config.baseUrl(request);
    callbackUrl = resolved.startsWith("http") ? resolved : `https://${resolved}`;
  } else {
    callbackUrl = config.baseUrl as string;
  }

  if (request.method === "POST") {
    let body: Record<string, string> = {};
    try {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        body = await request.json() as Record<string, string>;
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await request.text();
        body = Object.fromEntries(new URLSearchParams(text));
      }
    } catch {
      // ignore parse errors
    }

    // Verify CSRF
    const csrfCookie = getCsrfCookie(request, config);
    const submittedToken = body.csrfToken ?? "";
    if (csrfCookie && submittedToken) {
      const valid = await verifyCsrfToken(submittedToken, csrfCookie, config.secret);
      if (!valid && config.debug) {
        console.warn("[VinextAuth] CSRF verification failed on signout");
      }
    }

    if (body.callbackUrl) {
      callbackUrl = body.callbackUrl;
    }
  }

  const redirectUrl = isAbsoluteUrl(callbackUrl)
    ? callbackUrl
    : `${typeof config.baseUrl === "string" ? config.baseUrl : ""}${callbackUrl}`;

  const headers = new Headers();

  // ── Clear ALL vinextauth cookies — no stale tokens left behind ────────────
  const { sessionToken, callbackUrl: cbCookie, csrfToken, state, nonce } = config.cookies;

  for (const cookie of [sessionToken, cbCookie, csrfToken, state, nonce]) {
    headers.append("Set-Cookie", deleteCookieString(cookie.name, cookie.options));
    // Also clear the non-prefixed variant in case of prefix migration
    const unprefixed = cookie.name.replace("__Secure-", "");
    if (unprefixed !== cookie.name) {
      headers.append("Set-Cookie", deleteCookieString(unprefixed, { ...cookie.options, secure: false }));
    }
  }

  headers.set("Location", redirectUrl);

  return new Response(null, { status: 302, headers });
}

function isAbsoluteUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}
