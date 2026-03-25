// ─── Base User & Session ──────────────────────────────────────────────────────

export interface DefaultUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface DefaultSession {
  user: DefaultUser;
  expires: string;
}

export interface DefaultJWT {
  sub?: string;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
  iat?: number;
  exp?: number;
  jti?: string;
  [key: string]: unknown;
}

// ─── Generic types (the big DX win over NextAuth) ────────────────────────────
// Users pass their own types: VinextAuth<{ role: "admin"|"user" }>()
// No module augmentation needed.

export type User<TUser = {}> = DefaultUser & TUser;
export type Session<TSession = {}> = Omit<DefaultSession, "user"> & {
  user: DefaultUser & TSession;
};
export type JWT<TToken = {}> = DefaultJWT & TToken;

// ─── Providers ───────────────────────────────────────────────────────────────

export interface OAuthProvider {
  id: string;
  name: string;
  type: "oauth";
  clientId: string;
  clientSecret: string;
  authorization: {
    url: string;
    params?: Record<string, string>;
  };
  token: { url: string };
  userinfo: { url: string };
  profile(profile: Record<string, unknown>): DefaultUser;
  checks?: Array<"state" | "pkce" | "none">;
  scope?: string;
}

export interface CredentialsProvider<TCredentials extends Record<string, string> = Record<string, string>> {
  id: string;
  name: string;
  type: "credentials";
  credentials: {
    [K in keyof TCredentials]: {
      label: string;
      type?: string;
      placeholder?: string;
    };
  };
  authorize(credentials: TCredentials, request: Request): Promise<DefaultUser | null>;
}

export type Provider = OAuthProvider | CredentialsProvider;

// ─── Adapter ─────────────────────────────────────────────────────────────────

export interface AdapterSession {
  sessionToken: string;
  userId: string;
  expires: Date;
}

export interface AdapterInterface {
  getSession(sessionToken: string): Promise<(AdapterSession & { user: DefaultUser }) | null>;
  createSession(session: AdapterSession): Promise<AdapterSession>;
  updateSession(session: Partial<AdapterSession> & { sessionToken: string }): Promise<AdapterSession | null>;
  deleteSession(sessionToken: string): Promise<void>;
  getUserByEmail?(email: string): Promise<DefaultUser | null>;
  linkAccount?(userId: string, provider: string, providerAccountId: string): Promise<void>;
  getAccountByProvider?(provider: string, providerAccountId: string): Promise<{ userId: string } | null>;
}

// ─── Rate limiter interface ───────────────────────────────────────────────────

export interface RateLimiter {
  check(key: string): Promise<{ allowed: boolean; retryAfter?: number }>;
  reset(key: string): Promise<void>;
}

// ─── Callbacks ───────────────────────────────────────────────────────────────

export interface SignInCallbackParams<TUser = {}> {
  user: User<TUser>;
  account: {
    provider: string;
    type: "oauth" | "credentials";
    providerAccountId: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    token_type?: string;
    scope?: string;
    id_token?: string;
  } | null;
  profile?: Record<string, unknown>;
  isNewUser?: boolean;
}

export interface SessionCallbackParams<TSession = {}, TToken = {}> {
  session: Session<TSession>;
  token: JWT<TToken>;
  user?: User<TSession>;
}

export interface JWTCallbackParams<TToken = {}, TUser = {}> {
  token: JWT<TToken>;
  user?: User<TUser>;
  account?: SignInCallbackParams["account"];
  profile?: Record<string, unknown>;
  trigger?: "signIn" | "signUp" | "update";
  isNewUser?: boolean;
  session?: unknown;
}

export interface RefreshTokenCallbackParams<TToken = {}> {
  token: JWT<TToken>;
}

export interface RefreshTokenCallbackResult<TToken = {}> {
  token: JWT<TToken>;
  error?: string;
}

export interface CallbacksConfig<TSession = {}, TToken = {}, TUser = {}> {
  signIn?: (params: SignInCallbackParams<TUser>) => Promise<boolean | string> | boolean | string;
  session?: (params: SessionCallbackParams<TSession, TToken>) => Promise<Session<TSession>> | Session<TSession>;
  jwt?: (params: JWTCallbackParams<TToken, TUser>) => Promise<JWT<TToken>> | JWT<TToken>;
  redirect?: (params: { url: string; baseUrl: string }) => Promise<string> | string;
  refreshToken?: (params: RefreshTokenCallbackParams<TToken>) => Promise<RefreshTokenCallbackResult<TToken>>;
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export interface PagesConfig {
  signIn?: string;
  signOut?: string;
  error?: string;
  verifyRequest?: string;
  newUser?: string;
}

// ─── Session config ───────────────────────────────────────────────────────────

export interface SessionConfig {
  strategy?: "jwt" | "database";
  maxAge?: number;
  updateAge?: number;
}

// ─── JWT config ───────────────────────────────────────────────────────────────

export interface JWTConfig {
  secret?: string;
  maxAge?: number;
  encode?: (params: { token: DefaultJWT; secret: string; maxAge: number }) => Promise<string>;
  decode?: (params: { token: string; secret: string }) => Promise<DefaultJWT | null>;
}

// ─── Account linking ─────────────────────────────────────────────────────────

export interface AccountLinkingConfig {
  /**
   * Allow linking accounts with the same email across providers.
   * Unlike NextAuth's `allowDangerousEmailAccountLinking`, this uses
   * a safe flow that verifies email ownership before linking.
   */
  enabled?: boolean;
  /**
   * Require email verification before linking.
   * Default: true (safe mode)
   */
  requireVerification?: boolean;
}

// ─── Credentials config ───────────────────────────────────────────────────────

export interface CredentialsConfig {
  /**
   * Built-in rate limiting for credentials sign-in attempts.
   * Default: 5 attempts per 15 minutes per IP.
   */
  rateLimit?: {
    maxAttempts?: number;
    windowMs?: number;
    /**
     * Custom rate limiter (e.g., backed by Redis, KV, etc.)
     * If not provided, uses in-memory rate limiter.
     */
    store?: RateLimiter;
  };
}

// ─── Main config ──────────────────────────────────────────────────────────────

export interface VinextAuthConfig<TSession = {}, TToken = {}, TUser = {}> {
  providers: Provider[];
  secret?: string;

  /**
   * Branding and visual customization for built-in sign-in and error pages.
   */
  theme?: ThemeConfig;

  /**
   * Dynamic base URL — supports multi-tenant apps with custom domains.
   * Can be a static string or a function that receives the request.
   *
   * @example
   * baseUrl: (req) => `https://${req.headers.get("host")}`
   */
  baseUrl?: string | ((request: Request) => string | Promise<string>);

  callbacks?: CallbacksConfig<TSession, TToken, TUser>;
  pages?: PagesConfig;
  session?: SessionConfig;
  jwt?: JWTConfig;
  adapter?: AdapterInterface;
  debug?: boolean;
  useSecureCookies?: boolean;
  cookies?: Partial<CookiesConfig>;

  /**
   * Account linking configuration.
   * Replaces NextAuth's `allowDangerousEmailAccountLinking` with a safe, explicit API.
   */
  accountLinking?: AccountLinkingConfig;

  /**
   * Credentials provider configuration (rate limiting, etc.)
   */
  credentials?: CredentialsConfig;
}

// ─── Cookie config ───────────────────────────────────────────────────────────

export interface CookieOption {
  name: string;
  options: {
    httpOnly?: boolean;
    sameSite?: "lax" | "strict" | "none";
    path?: string;
    secure?: boolean;
    maxAge?: number;
    domain?: string;
  };
}

export interface CookiesConfig {
  sessionToken: CookieOption;
  callbackUrl: CookieOption;
  csrfToken: CookieOption;
  state: CookieOption;
  nonce: CookieOption;
}

// ─── Resolved config (internal) ───────────────────────────────────────────────

export interface ResolvedConfig {
  providers: Provider[];
  secret: string;
  baseUrl: string | ((request: Request) => string | Promise<string>);
  basePath: string;
  callbacks: CallbacksConfig;
  pages: Required<PagesConfig>;
  session: Required<SessionConfig>;
  jwt: Required<JWTConfig>;
  debug: boolean;
  useSecureCookies: boolean;
  cookies: CookiesConfig;
  adapter?: AdapterInterface;
  accountLinking: Required<AccountLinkingConfig>;
  credentials: CredentialsConfig;
  theme: Required<ThemeConfig>;
  /** @internal Rate limiter instance — one per VinextAuth() call, not global */
  _rateLimiter: RateLimiter;
}

// ─── Theme config ─────────────────────────────────────────────────────────────

export interface ThemeConfig {
  brandName?: string;
  logoUrl?: string;
  colorScheme?: "light" | "dark";
  buttonColor?: string;
}

// ─── Handler return ───────────────────────────────────────────────────────────

export interface VinextAuthHandlers {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  /**
   * Pre-bound server session helper — Auth.js v5 style.
   * Equivalent to getServerSession() but uses this instance's config automatically.
   *
   * @example
   * ```ts
   * // auth.ts
   * export const { GET, POST, auth } = VinextAuth({ ... })
   *
   * // server component
   * import { auth } from "@/auth"
   * const session = await auth()
   * ```
   */
  auth: <TSession = {}>() => Promise<Session<TSession> | null>;
}

// ─── React types ──────────────────────────────────────────────────────────────

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface SessionContextValue<TSession = {}> {
  data: Session<TSession> | null;
  status: SessionStatus;
  update: (data?: Partial<Session<TSession>>) => Promise<Session<TSession> | null>;
}

export interface SignInOptions {
  callbackUrl?: string;
  redirect?: boolean;
}

export interface SignOutOptions {
  callbackUrl?: string;
  redirect?: boolean;
}

// ─── Middleware types ─────────────────────────────────────────────────────────

export interface WithAuthOptions {
  pages?: {
    signIn?: string;
  };
  callbacks?: {
    authorized?: (params: { token: DefaultJWT | null; req: Request }) => boolean | Promise<boolean>;
  };
  secret?: string;
}

// ─── Error types ──────────────────────────────────────────────────────────────

export type VinextAuthErrorCode =
  | "OAuthAccountNotLinked"
  | "OAuthCallbackError"
  | "OAuthStateError"
  | "AccessDenied"
  | "RateLimitExceeded"
  | "InvalidCredentials"
  | "EmailNotVerified"
  | "SessionExpired"
  | "Configuration"
  | "Unknown";

export class VinextAuthError extends Error {
  code: VinextAuthErrorCode;
  constructor(code: VinextAuthErrorCode, message: string) {
    super(message);
    this.name = "VinextAuthError";
    this.code = code;
  }
}
