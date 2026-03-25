import type { ResolvedConfig, CredentialsProvider } from "../types.js";
import { buildJWT, buildSession, encodeSession } from "../core/session.js";
import { applySessionCookie, clearStateCookie, clearCallbackUrlCookie } from "../cookies/index.js";
import { getDefaultRateLimiter, getClientIp } from "../core/rate-limiter.js";

export async function handleCredentials(
  request: Request,
  provider: CredentialsProvider,
  config: ResolvedConfig
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // ── Rate limiting ────────────────────────────────────────────────────────
  const rateLimitConfig = config.credentials.rateLimit;
  const limiter =
    rateLimitConfig?.store ??
    getDefaultRateLimiter(
      rateLimitConfig?.maxAttempts ?? 5,
      rateLimitConfig?.windowMs ?? 15 * 60 * 1000
    );

  const ip = getClientIp(request);
  const rateLimitKey = `credentials:${provider.id}:${ip}`;
  const { allowed, retryAfter } = await limiter.check(rateLimitKey);

  if (!allowed) {
    const errorUrl = new URL(`${await resolveBase(config, request)}${config.pages.error}`);
    errorUrl.searchParams.set("error", "RateLimitExceeded");
    if (retryAfter) errorUrl.searchParams.set("retryAfter", String(retryAfter));
    return Response.redirect(errorUrl.toString(), 302);
  }

  // ── Parse credentials ────────────────────────────────────────────────────
  let body: Record<string, string> = {};
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await request.json() as Record<string, string>;
    } else {
      const text = await request.text();
      body = Object.fromEntries(new URLSearchParams(text));
    }
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const callbackUrl = body.callbackUrl ?? config.pages.newUser ?? "/";
  delete body.callbackUrl;
  delete body.csrfToken;

  // ── Authorize ────────────────────────────────────────────────────────────
  let user;
  try {
    user = await provider.authorize(body as never, request);
  } catch (err) {
    if (config.debug) console.error("[VinextAuth] Credentials authorize error:", err);
    const errorUrl = new URL(`${await resolveBase(config, request)}${config.pages.error}`);
    errorUrl.searchParams.set("error", "InvalidCredentials");
    return Response.redirect(errorUrl.toString(), 302);
  }

  if (!user) {
    // Reset rate limit on successful auth? No — only reset on success
    const errorUrl = new URL(`${await resolveBase(config, request)}${config.pages.error}`);
    errorUrl.searchParams.set("error", "InvalidCredentials");
    return Response.redirect(errorUrl.toString(), 302);
  }

  // ── Auth succeeded — reset rate limit ────────────────────────────────────
  await limiter.reset(rateLimitKey);

  // ── signIn callback ──────────────────────────────────────────────────────
  const account = {
    provider: provider.id,
    type: "credentials" as const,
    providerAccountId: user.id,
  };

  if (config.callbacks.signIn) {
    const result = await config.callbacks.signIn({ user, account, profile: undefined });
    if (result === false) {
      const errorUrl = new URL(`${await resolveBase(config, request)}${config.pages.error}`);
      errorUrl.searchParams.set("error", "AccessDenied");
      return Response.redirect(errorUrl.toString(), 302);
    }
    if (typeof result === "string") {
      return Response.redirect(result, 302);
    }
  }

  // ── Build JWT + session ──────────────────────────────────────────────────
  const jwtPayload = await buildJWT(user, account, undefined, config);
  const sessionToken = await encodeSession(jwtPayload, config);

  const baseUrl = await resolveBase(config, request);
  const redirectUrl = isAbsoluteUrl(callbackUrl) ? callbackUrl : `${baseUrl}${callbackUrl}`;

  const headers = new Headers();
  applySessionCookie(headers, sessionToken, config);
  clearStateCookie(headers, config);
  clearCallbackUrlCookie(headers, config);
  headers.set("Location", redirectUrl);

  return new Response(null, { status: 302, headers });
}

async function resolveBase(config: ResolvedConfig, request: Request): Promise<string> {
  if (typeof config.baseUrl === "function") {
    const r = await config.baseUrl(request);
    return r.startsWith("http") ? r : `https://${r}`;
  }
  return config.baseUrl as string;
}

function isAbsoluteUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}
