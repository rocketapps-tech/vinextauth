import type { CredentialsProvider as CredentialsProviderType, DefaultUser } from "../types.js";

export interface CredentialsProviderConfig<
  TCredentials extends Record<string, string> = Record<string, string>
> {
  id?: string;
  name?: string;
  credentials: {
    [K in keyof TCredentials]: {
      label: string;
      type?: string;
      placeholder?: string;
    };
  };
  authorize(credentials: TCredentials, request: Request): Promise<DefaultUser | null>;
}

/**
 * Credentials provider — supports email/password, API keys, or any custom auth.
 *
 * Unlike NextAuth, VinextAuth supports credentials with database sessions.
 * Built-in rate limiting (5 attempts / 15 min) — configurable via `credentials.rateLimit`.
 *
 * @example
 * ```ts
 * CredentialsProvider({
 *   credentials: {
 *     email: { label: "Email", type: "email" },
 *     password: { label: "Password", type: "password" },
 *   },
 *   async authorize({ email, password }) {
 *     const user = await db.user.findByEmail(email)
 *     if (!user || !verifyPassword(password, user.passwordHash)) return null
 *     return { id: user.id, email: user.email, name: user.name }
 *   }
 * })
 * ```
 */
export function CredentialsProvider<
  TCredentials extends Record<string, string> = Record<string, string>
>(config: CredentialsProviderConfig<TCredentials>): CredentialsProviderType<TCredentials> {
  return {
    id: config.id ?? "credentials",
    name: config.name ?? "Credentials",
    type: "credentials",
    credentials: config.credentials,
    authorize: config.authorize,
  };
}

export default CredentialsProvider;
