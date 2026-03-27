import type { VinextAuthConfig, ResolvedConfig } from '../types.js';
import { buildCookieNames } from '../cookies/strategy.js';
import { InMemoryRateLimiter } from './rate-limiter.js';

const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export function resolveConfig(config: VinextAuthConfig): ResolvedConfig {
  const secret =
    config.secret ?? (typeof process !== 'undefined' ? process.env.VINEXTAUTH_SECRET : undefined);

  if (!secret) {
    throw new Error(
      '[VinextAuth] No secret provided. Set VINEXTAUTH_SECRET env var, or pass `secret` to VinextAuth().'
    );
  }

  // baseUrl: supports string or dynamic function for multi-tenant apps
  const baseUrl =
    config.baseUrl ??
    (typeof process !== 'undefined'
      ? (process.env.VINEXTAUTH_URL ?? process.env.VERCEL_URL)
      : undefined) ??
    'http://localhost:3000';

  const resolvedBaseUrl =
    typeof baseUrl === 'string'
      ? baseUrl.startsWith('http')
        ? baseUrl
        : `https://${baseUrl}`
      : baseUrl; // keep as function for multi-tenant

  const staticBaseUrl =
    typeof resolvedBaseUrl === 'string' ? resolvedBaseUrl : 'http://localhost:3000';
  const useSecureCookies = config.useSecureCookies ?? staticBaseUrl.startsWith('https://');

  const sessionMaxAge = config.session?.maxAge ?? DEFAULT_MAX_AGE;

  return {
    providers: config.providers,
    secret,
    baseUrl: resolvedBaseUrl,
    basePath: '/api/auth',
    callbacks: config.callbacks ?? {},
    pages: {
      signIn: '/api/auth/signin',
      signOut: '/api/auth/signout',
      error: '/api/auth/error',
      verifyRequest: '/api/auth/verify-request',
      newUser: '/',
      ...config.pages,
    },
    session: {
      strategy: config.session?.strategy ?? 'jwt',
      maxAge: sessionMaxAge,
      updateAge: config.session?.updateAge ?? 24 * 60 * 60,
    },
    jwt: {
      secret,
      maxAge: sessionMaxAge,
      encode: config.jwt?.encode as ResolvedConfig['jwt']['encode'],
      decode: config.jwt?.decode as ResolvedConfig['jwt']['decode'],
    },
    debug: config.debug ?? false,
    useSecureCookies,
    cookies: {
      ...buildCookieNames(useSecureCookies),
      ...config.cookies,
    },
    adapter: config.adapter,
    accountLinking: {
      enabled: config.accountLinking?.enabled ?? false,
      requireVerification: config.accountLinking?.requireVerification ?? true,
    },
    credentials: config.credentials ?? {},
    theme: {
      brandName: config.theme?.brandName ?? 'Sign In',
      logoUrl: config.theme?.logoUrl ?? '',
      colorScheme: config.theme?.colorScheme ?? 'light',
      buttonColor: config.theme?.buttonColor ?? '#3182ce',
    },
    _rateLimiter:
      config.credentials?.rateLimit?.store ??
      new InMemoryRateLimiter(
        config.credentials?.rateLimit?.maxAttempts ?? 5,
        config.credentials?.rateLimit?.windowMs ?? 15 * 60 * 1000
      ),
    events: config.events ?? {},
  };
}

/**
 * Resolve the base URL for a given request (supports multi-tenant).
 */
export async function resolveBaseUrl(config: ResolvedConfig, request: Request): Promise<string> {
  if (typeof config.baseUrl === 'function') {
    const resolved = await config.baseUrl(request);
    return resolved.startsWith('http') ? resolved : `https://${resolved}`;
  }
  return config.baseUrl as string;
}
