import type { JWT, Session, ResolvedConfig } from "../types.js";
import * as jwtLib from "../jwt/index.js";
import { buildSessionFromJWT } from "../cookies/index.js";

export async function encodeSession(
  payload: JWT,
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
): Promise<JWT | null> {
  if (config.jwt.decode) {
    return config.jwt.decode({ token, secret: config.secret });
  }
  return jwtLib.verify(token, config.secret);
}

export async function buildSession(
  jwt: JWT,
  config: ResolvedConfig
): Promise<Session> {
  const baseSession = buildSessionFromJWT(jwt, config.session.maxAge);

  if (config.callbacks.session) {
    return config.callbacks.session({ session: baseSession, token: jwt });
  }

  return baseSession;
}

export async function buildJWT(
  user: { id: string; name?: string | null; email?: string | null; image?: string | null },
  account: Parameters<NonNullable<ResolvedConfig["callbacks"]["jwt"]>>[0]["account"],
  profile: Record<string, unknown> | undefined,
  config: ResolvedConfig
): Promise<JWT> {
  const now = Math.floor(Date.now() / 1000);

  let token: JWT = {
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
      trigger: "signIn",
    });
  }

  return token;
}

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
