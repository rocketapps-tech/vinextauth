import { V as VinextAuthConfig, a as VinextAuthHandlers } from './types-G_m6Z3Iz.js';
export { A as AdapterInterface, b as AdapterSession, C as CallbacksConfig, J as JWT, c as JWTCallbackParams, d as JWTConfig, O as OAuthProvider, P as PagesConfig, S as Session, e as SessionCallbackParams, f as SessionConfig, g as SessionContextValue, h as SessionStatus, i as SignInCallbackParams, j as SignInOptions, k as SignOutOptions, U as User, W as WithAuthOptions } from './types-G_m6Z3Iz.js';

/**
 * VinextAuth — main factory function.
 *
 * Usage (identical to NextAuth v4):
 * ```ts
 * const handler = VinextAuth(authOptions)
 * export { handler as GET, handler as POST }
 * ```
 */
declare function VinextAuth(config: VinextAuthConfig): VinextAuthHandlers;

export { VinextAuth, VinextAuthConfig, VinextAuthHandlers, VinextAuth as default };
