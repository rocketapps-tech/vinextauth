interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
}
interface Session {
    user: User;
    expires: string;
}
interface JWT {
    sub?: string;
    name?: string | null;
    email?: string | null;
    picture?: string | null;
    iat?: number;
    exp?: number;
    jti?: string;
    [key: string]: unknown;
}
interface OAuthProvider {
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
interface AdapterSession {
    sessionToken: string;
    userId: string;
    expires: Date;
}
interface AdapterInterface {
    getSession(sessionToken: string): Promise<(AdapterSession & {
        user: User;
    }) | null>;
    createSession(session: AdapterSession): Promise<AdapterSession>;
    updateSession(session: Partial<AdapterSession> & {
        sessionToken: string;
    }): Promise<AdapterSession | null>;
    deleteSession(sessionToken: string): Promise<void>;
}
interface SignInCallbackParams {
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
interface SessionCallbackParams {
    session: Session;
    token: JWT;
    user?: User;
}
interface JWTCallbackParams {
    token: JWT;
    user?: User;
    account?: SignInCallbackParams["account"];
    profile?: Record<string, unknown>;
    trigger?: "signIn" | "signUp" | "update";
    isNewUser?: boolean;
    session?: Session;
}
interface CallbacksConfig {
    signIn?: (params: SignInCallbackParams) => Promise<boolean | string> | boolean | string;
    session?: (params: SessionCallbackParams) => Promise<Session> | Session;
    jwt?: (params: JWTCallbackParams) => Promise<JWT> | JWT;
    redirect?: (params: {
        url: string;
        baseUrl: string;
    }) => Promise<string> | string;
}
interface PagesConfig {
    signIn?: string;
    signOut?: string;
    error?: string;
    verifyRequest?: string;
    newUser?: string;
}
interface SessionConfig {
    strategy?: "jwt" | "database";
    maxAge?: number;
    updateAge?: number;
}
interface JWTConfig {
    secret?: string;
    maxAge?: number;
    encode?: (params: {
        token: JWT;
        secret: string;
        maxAge: number;
    }) => Promise<string>;
    decode?: (params: {
        token: string;
        secret: string;
    }) => Promise<JWT | null>;
}
interface VinextAuthConfig {
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
interface CookieOption {
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
interface CookiesConfig {
    sessionToken: CookieOption;
    callbackUrl: CookieOption;
    csrfToken: CookieOption;
    state: CookieOption;
    nonce: CookieOption;
}
interface VinextAuthHandlers {
    GET: (request: Request) => Promise<Response>;
    POST: (request: Request) => Promise<Response>;
}
type SessionStatus = "loading" | "authenticated" | "unauthenticated";
interface SessionContextValue {
    data: Session | null;
    status: SessionStatus;
    update: (data?: Partial<Session>) => Promise<Session | null>;
}
interface SignInOptions {
    callbackUrl?: string;
    redirect?: boolean;
}
interface SignOutOptions {
    callbackUrl?: string;
    redirect?: boolean;
}
interface WithAuthOptions {
    pages?: {
        signIn?: string;
    };
    callbacks?: {
        authorized?: (params: {
            token: JWT | null;
            req: Request;
        }) => boolean | Promise<boolean>;
    };
    secret?: string;
}

export type { AdapterInterface as A, CallbacksConfig as C, JWT as J, OAuthProvider as O, PagesConfig as P, Session as S, User as U, VinextAuthConfig as V, WithAuthOptions as W, VinextAuthHandlers as a, AdapterSession as b, JWTCallbackParams as c, JWTConfig as d, SessionCallbackParams as e, SessionConfig as f, SessionContextValue as g, SessionStatus as h, SignInCallbackParams as i, SignInOptions as j, SignOutOptions as k };
