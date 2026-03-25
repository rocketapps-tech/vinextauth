import type { VinextAuthConfig, ResolvedConfig } from "../types.js";
import { buildCookieNames } from "../cookies/strategy.js";

const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function resolveConfig(config: VinextAuthConfig): ResolvedConfig {
  const secret =
    config.secret ??
    (typeof process !== "undefined"
      ? process.env.NEXTAUTH_SECRET ?? process.env.VINEXTAUTH_SECRET
      : undefined);

  if (!secret) {
    throw new Error(
      "[VinextAuth] No secret provided. Set NEXTAUTH_SECRET or VINEXTAUTH_SECRET env var, or pass `secret` to VinextAuth()."
    );
  }

  const baseUrl =
    (typeof process !== "undefined"
      ? process.env.NEXTAUTH_URL ?? process.env.VINEXTAUTH_URL ?? process.env.VERCEL_URL
      : undefined) ?? "http://localhost:3000";

  const normalizedBaseUrl = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;

  const useSecureCookies =
    config.useSecureCookies ?? normalizedBaseUrl.startsWith("https://");

  const sessionMaxAge = config.session?.maxAge ?? DEFAULT_MAX_AGE;

  return {
    providers: config.providers,
    secret,
    baseUrl: normalizedBaseUrl,
    basePath: "/api/auth",
    callbacks: config.callbacks ?? {},
    pages: {
      signIn: "/api/auth/signin",
      signOut: "/api/auth/signout",
      error: "/api/auth/error",
      verifyRequest: "/api/auth/verify-request",
      newUser: "/",
      ...config.pages,
    },
    session: {
      strategy: config.session?.strategy ?? "jwt",
      maxAge: sessionMaxAge,
      updateAge: config.session?.updateAge ?? 24 * 60 * 60,
    },
    jwt: {
      secret,
      maxAge: sessionMaxAge,
      encode: config.jwt?.encode as ResolvedConfig["jwt"]["encode"],
      decode: config.jwt?.decode as ResolvedConfig["jwt"]["decode"],
    },
    debug: config.debug ?? false,
    useSecureCookies,
    cookies: {
      ...buildCookieNames(useSecureCookies),
      ...config.cookies,
    },
    adapter: config.adapter,
  };
}
