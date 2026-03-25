import type { ResolvedConfig } from "../types.js";
import { getSessionToken } from "../cookies/index.js";
import { decodeSession, buildSession, refreshTokenIfNeeded, encodeSession, getSessionFromToken } from "../core/session.js";
import { applySessionCookie } from "../cookies/index.js";

export async function handleSessionRoute(
  request: Request,
  config: ResolvedConfig
): Promise<Response> {
  const token = getSessionToken(request, config);

  if (!token) {
    return Response.json({}, { headers: noCacheHeaders() });
  }

  // ── Database strategy ─────────────────────────────────────────────────────
  if (config.session.strategy === "database" && config.adapter) {
    const session = await getSessionFromToken(token, config);
    if (!session) return Response.json({}, { headers: noCacheHeaders() });
    return Response.json(session, { headers: noCacheHeaders() });
  }

  // ── JWT strategy — with automatic token rotation ──────────────────────────
  let jwt = await decodeSession(token, config);
  if (!jwt) {
    return Response.json({}, { headers: noCacheHeaders() });
  }

  const refreshed = await refreshTokenIfNeeded(jwt, config);
  const headers = new Headers(noCacheHeaders());

  if (refreshed !== jwt) {
    const newToken = await encodeSession(refreshed, config);
    applySessionCookie(headers, newToken, config);
    jwt = refreshed;
  }

  const session = await buildSession(jwt, config);
  const refreshError = jwt.refreshError as string | undefined;
  const responseBody = refreshError ? { ...session, refreshError } : session;

  return Response.json(responseBody, { headers });
}

function noCacheHeaders(): HeadersInit {
  return { "Cache-Control": "no-store, max-age=0" };
}
