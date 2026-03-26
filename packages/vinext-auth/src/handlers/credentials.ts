import type { ResolvedConfig, CredentialsProvider } from "../types.js";
import { buildJWT, encodeSession, generateId } from "../core/session.js";
import { applySessionCookie, clearStateCookie, clearCallbackUrlCookie, getCsrfCookie } from "../cookies/index.js";
import { getClientIp } from "../core/rate-limiter.js";
import { verifyCsrfToken } from "../core/csrf.js";

export async function handleCredentials(
  request: Request,
  provider: CredentialsProvider,
  config: ResolvedConfig
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // ── CSRF verification ────────────────────────────────────────────────────
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

  const csrfCookie = getCsrfCookie(request, config);
  const submittedCsrf = body.csrfToken ?? "";
  if (!csrfCookie || !submittedCsrf) {
    return new Response("CSRF token required", { status: 403 });
  }
  const csrfValid = await verifyCsrfToken(submittedCsrf, csrfCookie, config.secret);
  if (!csrfValid) {
    if (config.debug) console.warn("[VinextAuth] CSRF verification failed on credentials signin");
    return new Response("Invalid CSRF token", { status: 403 });
  }

  // ── Rate limiting ────────────────────────────────────────────────────────
  const limiter = config._rateLimiter;

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
      const baseUrl = await resolveBase(config, request);
      return Response.redirect(sanitizeRedirectUrl(result, baseUrl), 302);
    }
  }

  const baseUrl = await resolveBase(config, request);
  const redirectUrl = sanitizeRedirectUrl(callbackUrl, baseUrl);

  const headers = new Headers();

  // ── Database strategy ────────────────────────────────────────────────────
  if (config.session.strategy === "database" && config.adapter) {
    const sessionToken = generateId();
    const expires = new Date(Date.now() + config.session.maxAge * 1000);
    await config.adapter.createSession({ sessionToken, userId: user.id, expires });
    applySessionCookie(headers, sessionToken, config);
    clearStateCookie(headers, config);
    clearCallbackUrlCookie(headers, config);
    headers.set("Location", redirectUrl);
    return new Response(null, { status: 302, headers });
  }

  // ── JWT strategy ─────────────────────────────────────────────────────────
  const jwtPayload = await buildJWT(user, account, undefined, config);
  const sessionToken = await encodeSession(jwtPayload, config);

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

/** Returns a safe redirect URL restricted to the app's own origin. */
function sanitizeRedirectUrl(url: string, baseUrl: string): string {
  if (url.startsWith("/") && !url.startsWith("//")) {
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
