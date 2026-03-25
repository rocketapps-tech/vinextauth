import type { DefaultJWT, DefaultSession, ResolvedConfig, DefaultUser } from "../types.js";
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

export function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
