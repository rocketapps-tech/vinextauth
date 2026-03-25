import type { Session, VinextAuthConfig } from "../types.js";
import { resolveConfig } from "../core/config.js";
import { decodeSession, buildSession } from "../core/session.js";
import { getResolvedConfig } from "../handlers/index.js";

/**
 * getServerSession — drop-in for NextAuth v4's getServerSession.
 *
 * Usage (identical to NextAuth v4):
 * ```ts
 * const session = await getServerSession(authOptions)
 * ```
 *
 * Works in:
 * - Next.js App Router Server Components
 * - Server Actions
 * - Route Handlers
 * - Vinext/Cloudflare Workers
 */
export async function getServerSession(
  config?: VinextAuthConfig
): Promise<Session | null> {
  const resolved = config ? resolveConfig(config) : getResolvedConfig();

  if (!resolved) {
    console.warn(
      "[VinextAuth] getServerSession called before VinextAuth() was initialized. " +
      "Pass authOptions directly: getServerSession(authOptions)"
    );
    return null;
  }

  // Try to get the session token from headers (Next.js server context)
  let token: string | null = null;

  try {
    // Dynamic import to avoid breaking in non-Next.js environments
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    const secureName = `__Secure-${resolved.cookies.sessionToken.name.replace("__Secure-", "")}`;
    token =
      cookieStore.get(secureName)?.value ??
      cookieStore.get(resolved.cookies.sessionToken.name)?.value ??
      null;
  } catch {
    // Not in Next.js context — token not available via this method
    return null;
  }

  if (!token) return null;

  const jwt = await decodeSession(token, resolved);
  if (!jwt) return null;

  return buildSession(jwt, resolved);
}

/**
 * auth — zero-argument alias for Auth.js v5 style usage.
 * Requires VinextAuth() to have been called first (e.g., in the route handler).
 */
export async function auth(): Promise<Session | null> {
  return getServerSession();
}

// NextAuth v4 compat alias
export { getServerSession as getSession };
