import type { DefaultSession, VinextAuthConfig, Session } from "../types.js";
import { resolveConfig } from "../core/config.js";
import { decodeSession, buildSession, encodeSession, generateId, getSessionFromToken } from "../core/session.js";
import { getResolvedConfig } from "../handlers/index.js";

/**
 * getServerSession — drop-in for NextAuth v4's getServerSession.
 *
 * Fully typed with generics — no module augmentation needed.
 *
 * @example
 * ```ts
 * // Basic usage (identical to NextAuth v4)
 * const session = await getServerSession(authOptions)
 *
 * // Typed usage
 * const session = await getServerSession<{ role: string }>(authOptions)
 * session?.user.role // string ✅
 * ```
 */
export async function getServerSession<TSession = {}>(
  config?: VinextAuthConfig
): Promise<Session<TSession> | null> {
  const resolved = config ? resolveConfig(config as VinextAuthConfig) : getResolvedConfig();

  if (!resolved) {
    console.warn(
      "[VinextAuth] getServerSession called before VinextAuth() was initialized. " +
      "Pass authOptions directly: getServerSession(authOptions)"
    );
    return null;
  }

  let token: string | null = null;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    const secureName = `__Secure-${resolved.cookies.sessionToken.name.replace("__Secure-", "")}`;
    token =
      cookieStore.get(secureName)?.value ??
      cookieStore.get(resolved.cookies.sessionToken.name)?.value ??
      null;
  } catch {
    return null;
  }

  if (!token) return null;

  return getSessionFromToken<TSession>(token, resolved);
}

/**
 * updateSession — update the session from server-side code (Server Actions, Route Handlers).
 *
 * NextAuth v4 had NO server-side session update — only client-side `useSession().update()`.
 * VinextAuth fixes this.
 *
 * @example
 * ```ts
 * // In a Server Action
 * await updateSession(authOptions, { user: { role: "admin" } })
 * ```
 */
export async function updateSession<TSession = {}>(
  config: VinextAuthConfig,
  updates: Partial<Session<TSession>>
): Promise<Session<TSession> | null> {
  const resolved = resolveConfig(config as VinextAuthConfig);

  let token: string | null = null;
  let cookieStore: Awaited<ReturnType<typeof import("next/headers").cookies>>;

  try {
    const { cookies } = await import("next/headers");
    cookieStore = await cookies();
    const secureName = `__Secure-${resolved.cookies.sessionToken.name.replace("__Secure-", "")}`;
    token =
      cookieStore.get(secureName)?.value ??
      cookieStore.get(resolved.cookies.sessionToken.name)?.value ??
      null;
  } catch {
    return null;
  }

  if (!token) return null;

  let jwt = await decodeSession(token, resolved);
  if (!jwt) return null;

  // Apply updates to the JWT
  if (updates.user) {
    jwt = {
      ...jwt,
      name: updates.user.name ?? jwt.name,
      email: updates.user.email ?? jwt.email,
      picture: (updates.user as DefaultSession["user"]).image ?? jwt.picture,
      ...(updates.user as Record<string, unknown>),
    };
  }

  // Reissue token
  jwt.jti = generateId();
  const newToken = await encodeSession(jwt, resolved);

  // Set the new cookie
  try {
    const { cookies: setCookies } = await import("next/headers");
    const store = await setCookies();
    const { name, options } = resolved.cookies.sessionToken;
    store.set(name, newToken, {
      ...options,
      maxAge: resolved.session.maxAge,
    });
  } catch {
    // Not in a context where cookies can be set
  }

  return buildSession(jwt, resolved) as Promise<Session<TSession>>;
}

/**
 * invalidateSession — revoke the current session server-side.
 *
 * For database sessions, deletes from the adapter.
 * For JWT sessions, sets the cookie to expire immediately.
 */
export async function invalidateSession(config?: VinextAuthConfig): Promise<void> {
  const resolved = config ? resolveConfig(config as VinextAuthConfig) : getResolvedConfig();
  if (!resolved) return;

  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const { name, options } = resolved.cookies.sessionToken;

    // Delete database session if applicable
    const token = store.get(name)?.value;
    if (token && resolved.adapter?.deleteSession) {
      if (resolved.session.strategy === "database") {
        // Cookie IS the session token
        await resolved.adapter.deleteSession(token);
      } else {
        // JWT strategy — extract jti to use as session token
        const jwt = await decodeSession(token, resolved);
        if (jwt?.jti) await resolved.adapter.deleteSession(jwt.jti);
      }
    }

    // Clear the cookie
    store.set(name, "", { ...options, maxAge: 0 });
  } catch {
    // not in Next.js context
  }
}

/**
 * auth — zero-argument alias (Auth.js v5 style).
 */
export async function auth<TSession = {}>(): Promise<Session<TSession> | null> {
  return getServerSession<TSession>();
}

// NextAuth v4 compat aliases
export { getServerSession as getSession };
