import type { DefaultJWT, DefaultSession, ResolvedConfig, DefaultUser, AdapterSession, Session } from "../types.js";
import * as jwtLib from "../jwt/index.js";
import { buildSessionFromJWT } from "../cookies/index.js";
import { withRefreshLock } from "./refresh-lock.js";

export async function encodeSession(
  payload: DefaultJWT,
  config: ResolvedConfig
): Promise<string> {
  if (config.jwt.encode) {
    return config.jwt.encode({
      token: payload,
      secret: config.secret,
      maxAge: config.session.maxAge,
    });
  }
  return jwtLib.sign(payload, config.secret);
}

export async function decodeSession(
  token: string,
  config: ResolvedConfig
): Promise<DefaultJWT | null> {
  if (config.jwt.decode) {
    return config.jwt.decode({ token, secret: config.secret });
  }
  return jwtLib.verify(token, config.secret);
}

export async function buildSession(
  jwt: DefaultJWT,
  config: ResolvedConfig
): Promise<DefaultSession> {
  const baseSession = buildSessionFromJWT(jwt, config.session.maxAge);

  if (config.callbacks.session) {
    return config.callbacks.session({ session: baseSession, token: jwt }) as Promise<DefaultSession>;
  }

  return baseSession;
}

export async function buildJWT(
  user: DefaultUser,
  account: Parameters<NonNullable<ResolvedConfig["callbacks"]["jwt"]>>[0]["account"],
  profile: Record<string, unknown> | undefined,
  config: ResolvedConfig,
  trigger: "signIn" | "signUp" = "signIn"
): Promise<DefaultJWT> {
  const now = Math.floor(Date.now() / 1000);

  let token: DefaultJWT = {
    sub: user.id,
    name: user.name,
    email: user.email,
    picture: user.image,
    iat: now,
    exp: now + config.session.maxAge,
    jti: generateId(),
  };

  if (config.callbacks.jwt) {
    token = await config.callbacks.jwt({
      token,
      user,
      account,
      profile,
      trigger,
    }) as DefaultJWT;
  }

  return token;
}

/**
 * Refresh access token with race condition protection.
 * Multiple concurrent requests will queue — only one refresh runs at a time.
 */
export async function refreshTokenIfNeeded(
  jwt: DefaultJWT,
  config: ResolvedConfig
): Promise<DefaultJWT> {
  if (!config.callbacks.refreshToken) return jwt;

  const accessTokenExpires = jwt.accessTokenExpires as number | undefined;
  const now = Date.now();

  // Only refresh if access token is expired or expiring within 60 seconds
  if (!accessTokenExpires || now < accessTokenExpires - 60_000) {
    return jwt;
  }

  const tokenId = jwt.jti ?? jwt.sub ?? "unknown";

  return withRefreshLock(tokenId, async () => {
    const result = await config.callbacks.refreshToken!({ token: jwt });
    if (result.error) {
      if (config.debug) {
        console.warn("[VinextAuth] Token refresh failed:", result.error);
      }
      // Mark token as having a refresh error — client can handle this
      return { ...result.token, refreshError: result.error };
    }
    return result.token as DefaultJWT;
  });
}

/**
 * Build a session from a database adapter result.
 * Used when session.strategy = "database".
 */
export async function buildDatabaseSession(
  adapterSession: AdapterSession & { user: DefaultUser },
  config: ResolvedConfig
): Promise<DefaultSession> {
  const baseSession: DefaultSession = {
    user: adapterSession.user,
    expires: adapterSession.expires.toISOString(),
  };

  if (config.callbacks.session) {
    return config.callbacks.session({
      session: baseSession,
      token: {},
      user: adapterSession.user,
    }) as Promise<DefaultSession>;
  }

  return baseSession;
}

/**
 * Unified session reader — handles both JWT and database strategies.
 * Use this in session-route, getServerSession and auth() to avoid duplication.
 */
export async function getSessionFromToken<TSession = {}>(
  token: string,
  config: ResolvedConfig
): Promise<Session<TSession> | null> {
  if (config.session.strategy === "database" && config.adapter) {
    const adapterSession = await config.adapter.getSession(token);
    if (!adapterSession) return null;

    if (adapterSession.expires < new Date()) {
      await config.adapter.deleteSession(token);
      return null;
    }

    return buildDatabaseSession(adapterSession, config) as Promise<Session<TSession>>;
  }

  // JWT strategy
  let jwt = await decodeSession(token, config);
  if (!jwt) return null;

  jwt = await refreshTokenIfNeeded(jwt, config);
  return buildSession(jwt, config) as Promise<Session<TSession>>;
}

export function generateId(): string {
  const bytes = new Uint8Array(32); // 256 bits of entropy
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
