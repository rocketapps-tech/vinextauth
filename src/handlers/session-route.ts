import type { ResolvedConfig } from "../types.js";
import { getSessionToken } from "../cookies/index.js";
import { decodeSession, buildSession, refreshTokenIfNeeded, encodeSession } from "../core/session.js";
import { applySessionCookie } from "../cookies/index.js";

export async function handleSessionRoute(
  request: Request,
  config: ResolvedConfig
): Promise<Response> {
  const token = getSessionToken(request, config);

  if (!token) {
    return Response.json({}, { headers: noCacheHeaders() });
  }

  let jwt = await decodeSession(token, config);
  if (!jwt) {
    return Response.json({}, { headers: noCacheHeaders() });
  }

  // ── Refresh token if needed (automatic rotation) ──────────────────────────
  const refreshed = await refreshTokenIfNeeded(jwt, config);
  const headers = new Headers(noCacheHeaders());

  if (refreshed !== jwt) {
    // Token was refreshed — reissue the session cookie
    const newToken = await encodeSession(refreshed, config);
    applySessionCookie(headers, newToken, config);
    jwt = refreshed;
  }

  const session = await buildSession(jwt, config);

  // Include refresh error in response so client can handle it
  const refreshError = jwt.refreshError as string | undefined;
  const responseBody = refreshError ? { ...session, refreshError } : session;

  return Response.json(responseBody, { headers });
}

function noCacheHeaders(): HeadersInit {
  return { "Cache-Control": "no-store, max-age=0" };
}
