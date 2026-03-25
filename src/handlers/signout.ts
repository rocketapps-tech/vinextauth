import type { ResolvedConfig } from "../types.js";
import { clearSessionCookie, clearCallbackUrlCookie } from "../cookies/index.js";
import { getCsrfCookie } from "../cookies/index.js";
import { verifyCsrfToken } from "../core/csrf.js";

export async function handleSignOut(
  request: Request,
  config: ResolvedConfig
): Promise<Response> {
  let callbackUrl = config.baseUrl;

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
    if (csrfCookie) {
      const valid = await verifyCsrfToken(submittedToken, csrfCookie, config.secret);
      if (!valid && config.debug) {
        console.warn("[VinextAuth] CSRF verification failed on signout");
      }
    }

    callbackUrl = body.callbackUrl ?? config.baseUrl;
  }

  const headers = new Headers();
  clearSessionCookie(headers, config);
  clearCallbackUrlCookie(headers, config);

  const redirectUrl = isAbsoluteUrl(callbackUrl)
    ? callbackUrl
    : `${config.baseUrl}${callbackUrl}`;

  headers.set("Location", redirectUrl);

  return new Response(null, { status: 302, headers });
}

function isAbsoluteUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}
