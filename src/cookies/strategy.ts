import type { CookiesConfig } from "../types.js";

export const SESSION_TOKEN_COOKIE = "vinextauth.session-token";
export const CALLBACK_URL_COOKIE = "vinextauth.callback-url";
export const CSRF_TOKEN_COOKIE = "vinextauth.csrf-token";
export const STATE_COOKIE = "vinextauth.state";
export const NONCE_COOKIE = "vinextauth.nonce";

// Secure prefix for HTTPS
const SECURE_PREFIX = "__Secure-";

export function buildCookieNames(useSecure: boolean): CookiesConfig {
  const prefix = useSecure ? SECURE_PREFIX : "";

  return {
    sessionToken: {
      name: `${prefix}${SESSION_TOKEN_COOKIE}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure,
      },
    },
    callbackUrl: {
      name: `${prefix}${CALLBACK_URL_COOKIE}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure,
      },
    },
    csrfToken: {
      name: `${prefix}${CSRF_TOKEN_COOKIE}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure,
      },
    },
    state: {
      name: `${prefix}${STATE_COOKIE}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure,
        maxAge: 60 * 15, // 15 minutes
      },
    },
    nonce: {
      name: `${prefix}${NONCE_COOKIE}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure,
        maxAge: 60 * 15,
      },
    },
  };
}

export function serializeCookie(name: string, value: string, options: CookiesConfig[keyof CookiesConfig]["options"] & { maxAge?: number }): string {
  let cookie = `${name}=${encodeURIComponent(value)}`;

  if (options.httpOnly) cookie += "; HttpOnly";
  if (options.secure) cookie += "; Secure";
  if (options.sameSite) cookie += `; SameSite=${capitalize(options.sameSite)}`;
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
  if (options.domain) cookie += `; Domain=${options.domain}`;

  return cookie;
}

export function deleteCookieString(name: string, options: CookiesConfig[keyof CookiesConfig]["options"]): string {
  return serializeCookie(name, "", { ...options, maxAge: 0 });
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
