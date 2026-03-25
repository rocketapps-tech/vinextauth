// ─── User & Session ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface Session {
  user: User;
  expires: string; // ISO date string
}

export interface JWT {
  sub?: string;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
  iat?: number;
  exp?: number;
  jti?: string;
  [key: string]: unknown;
}

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
  token: {
    url: string;
  };
  userinfo: {
    url: string;
  };
  profile(profile: Record<string, unknown>): User;
  checks?: Array<"state" | "pkce" | "none">;
  scope?: string;
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export interface AdapterSession {
  sessionToken: string;
  userId: string;
  expires: Date;
}

export interface AdapterInterface {
  getSession(sessionToken: string): Promise<(AdapterSession & { user: User }) | null>;
  createSession(session: AdapterSession): Promise<AdapterSession>;
  updateSession(session: Partial<AdapterSession> & { sessionToken: string }): Promise<AdapterSession | null>;
  deleteSession(sessionToken: string): Promise<void>;
}

// ─── Callbacks ───────────────────────────────────────────────────────────────

export interface SignInCallbackParams {
  user: User;
  account: {
    provider: string;
    type: string;
    providerAccountId: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    token_type?: string;
    scope?: string;
    id_token?: string;
  } | null;
  profile?: Record<string, unknown>;
}

export interface SessionCallbackParams {
  session: Session;
  token: JWT;
  user?: User;
}

export interface JWTCallbackParams {
  token: JWT;
  user?: User;
  account?: SignInCallbackParams["account"];
  profile?: Record<string, unknown>;
  trigger?: "signIn" | "signUp" | "update";
  isNewUser?: boolean;
  session?: Session;
}

export interface CallbacksConfig {
  signIn?: (params: SignInCallbackParams) => Promise<boolean | string> | boolean | string;
  session?: (params: SessionCallbackParams) => Promise<Session> | Session;
  jwt?: (params: JWTCallbackParams) => Promise<JWT> | JWT;
  redirect?: (params: { url: string; baseUrl: string }) => Promise<string> | string;
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
  maxAge?: number; // seconds, default 30 days
  updateAge?: number; // seconds, default 24 hours
}

// ─── JWT config ───────────────────────────────────────────────────────────────

export interface JWTConfig {
  secret?: string;
  maxAge?: number;
  encode?: (params: { token: JWT; secret: string; maxAge: number }) => Promise<string>;
  decode?: (params: { token: string; secret: string }) => Promise<JWT | null>;
}

// ─── Main config ──────────────────────────────────────────────────────────────

export interface VinextAuthConfig {
  providers: OAuthProvider[];
  secret?: string;
  callbacks?: CallbacksConfig;
  pages?: PagesConfig;
  session?: SessionConfig;
  jwt?: JWTConfig;
  adapter?: AdapterInterface;
  debug?: boolean;
  useSecureCookies?: boolean;
  cookies?: Partial<CookiesConfig>;
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

export interface ResolvedConfig extends Required<Omit<VinextAuthConfig, "adapter" | "cookies" | "jwt">> {
  secret: string;
  baseUrl: string;
  basePath: string;
  adapter?: AdapterInterface;
  cookies: CookiesConfig;
  jwt: Required<JWTConfig>;
}

// ─── Handler return ───────────────────────────────────────────────────────────

export interface VinextAuthHandlers {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
}

// ─── React types ──────────────────────────────────────────────────────────────

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface SessionContextValue {
  data: Session | null;
  status: SessionStatus;
  update: (data?: Partial<Session>) => Promise<Session | null>;
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
    authorized?: (params: { token: JWT | null; req: Request }) => boolean | Promise<boolean>;
  };
  secret?: string;
}
