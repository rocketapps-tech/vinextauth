import type { ResolvedConfig } from "../types.js";
import { getSessionToken } from "../cookies/index.js";
import { decodeSession, buildSession } from "../core/session.js";

export async function handleSessionRoute(
  request: Request,
  config: ResolvedConfig
): Promise<Response> {
  const token = getSessionToken(request, config);

  if (!token) {
    return Response.json({});
  }

  const jwt = await decodeSession(token, config);
  if (!jwt) {
    return Response.json({});
  }

  const session = await buildSession(jwt, config);

  return Response.json(session, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
