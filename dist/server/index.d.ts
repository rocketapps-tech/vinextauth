import { S as Session, V as VinextAuthConfig } from '../types-G_m6Z3Iz.js';

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
declare function getServerSession(config?: VinextAuthConfig): Promise<Session | null>;
/**
 * auth — zero-argument alias for Auth.js v5 style usage.
 * Requires VinextAuth() to have been called first (e.g., in the route handler).
 */
declare function auth(): Promise<Session | null>;

export { auth, getServerSession, getServerSession as getSession };
