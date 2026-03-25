import type { ResolvedConfig, Session } from "../types.js";
import { serializeCookie, deleteCookieString } from "./strategy.js";

// ─── Read ─────────────────────────────────────────────────────────────────────

export function getSessionToken(request: Request, config: ResolvedConfig): string | null {
  return getCookieValue(request, config.cookies.sessionToken.name);
}

export function getCallbackUrl(request: Request, config: ResolvedConfig): string | null {
  return getCookieValue(request, config.cookies.callbackUrl.name);
}

export function getCsrfCookie(request: Request, config: ResolvedConfig): string | null {
  return getCookieValue(request, config.cookies.csrfToken.name);
}

export function getStateCookie(request: Request, config: ResolvedConfig): string | null {
  return getCookieValue(request, config.cookies.state.name);
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...val] = part.trim().split("=");
    if (key.trim() === name) {
      return decodeURIComponent(val.join("="));
    }
  }
  return null;
}

// ─── Set ──────────────────────────────────────────────────────────────────────

export function applySessionCookie(headers: Headers, token: string, config: ResolvedConfig): void {
  const { name, options } = config.cookies.sessionToken;
  headers.append(
    "Set-Cookie",
    serializeCookie(name, token, { ...options, maxAge: config.session.maxAge })
  );
}

export function applyCallbackUrlCookie(headers: Headers, url: string, config: ResolvedConfig): void {
  const { name, options } = config.cookies.callbackUrl;
  headers.append("Set-Cookie", serializeCookie(name, url, { ...options, maxAge: 60 * 10 }));
}

export function applyCsrfCookie(headers: Headers, value: string, config: ResolvedConfig): void {
  const { name, options } = config.cookies.csrfToken;
  headers.append("Set-Cookie", serializeCookie(name, value, options));
}

export function applyStateCookie(headers: Headers, state: string, config: ResolvedConfig): void {
  const { name, options } = config.cookies.state;
  headers.append("Set-Cookie", serializeCookie(name, state, options));
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function clearSessionCookie(headers: Headers, config: ResolvedConfig): void {
  const { name, options } = config.cookies.sessionToken;
  headers.append("Set-Cookie", deleteCookieString(name, options));
}

export function clearStateCookie(headers: Headers, config: ResolvedConfig): void {
  const { name, options } = config.cookies.state;
  headers.append("Set-Cookie", deleteCookieString(name, options));
}

export function clearCallbackUrlCookie(headers: Headers, config: ResolvedConfig): void {
  const { name, options } = config.cookies.callbackUrl;
  headers.append("Set-Cookie", deleteCookieString(name, options));
}

// ─── Session cookie helpers ───────────────────────────────────────────────────

export function sessionToExpires(maxAge: number): string {
  return new Date(Date.now() + maxAge * 1000).toISOString();
}

export function buildSessionFromJWT(
  jwt: Record<string, unknown>,
  maxAge: number
): Session {
  return {
    user: {
      id: (jwt.sub as string) ?? "",
      name: (jwt.name as string | null) ?? null,
      email: (jwt.email as string | null) ?? null,
      image: (jwt.picture as string | null) ?? null,
    },
    expires: sessionToExpires(maxAge),
  };
}
