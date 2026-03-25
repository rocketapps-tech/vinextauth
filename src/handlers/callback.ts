import type { ResolvedConfig, SignInCallbackParams } from "../types.js";
import {
  getStateCookie,
  getCallbackUrl,
  applySessionCookie,
  clearStateCookie,
  clearCallbackUrlCookie,
} from "../cookies/index.js";
import { buildJWT, buildSession, encodeSession } from "../core/session.js";

export async function handleCallback(
  request: Request,
  providerId: string,
  config: ResolvedConfig
): Promise<Response> {
  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) return new Response("Unknown provider", { status: 404 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const errorUrl = new URL(`${config.baseUrl}${config.pages.error}`);
    errorUrl.searchParams.set("error", error);
    return Response.redirect(errorUrl.toString(), 302);
  }

  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  // Verify state
  const storedState = getStateCookie(request, config);
  if (provider.checks?.includes("state")) {
    if (!storedState || storedState !== stateParam) {
      const errorUrl = new URL(`${config.baseUrl}${config.pages.error}`);
      errorUrl.searchParams.set("error", "OAuthStateError");
      return Response.redirect(errorUrl.toString(), 302);
    }
  }

  // Exchange code for tokens
  const redirectUri = `${config.baseUrl}${config.basePath}/callback/${providerId}`;
  let tokenData: Record<string, unknown>;

  try {
    const tokenResponse = await fetch(provider.token.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    tokenData = await tokenResponse.json() as Record<string, unknown>;
  } catch (err) {
    if (config.debug) console.error("[VinextAuth] Token exchange error:", err);
    const errorUrl = new URL(`${config.baseUrl}${config.pages.error}`);
    errorUrl.searchParams.set("error", "OAuthCallbackError");
    return Response.redirect(errorUrl.toString(), 302);
  }

  // Fetch user profile
  let rawProfile: Record<string, unknown>;
  try {
    const userInfoResponse = await fetch(provider.userinfo.url, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error(`UserInfo fetch failed: ${userInfoResponse.status}`);
    }

    rawProfile = await userInfoResponse.json() as Record<string, unknown>;
  } catch (err) {
    if (config.debug) console.error("[VinextAuth] UserInfo error:", err);
    const errorUrl = new URL(`${config.baseUrl}${config.pages.error}`);
    errorUrl.searchParams.set("error", "OAuthCallbackError");
    return Response.redirect(errorUrl.toString(), 302);
  }

  const user = provider.profile(rawProfile);

  const account: SignInCallbackParams["account"] = {
    provider: providerId,
    type: "oauth",
    providerAccountId: user.id,
    access_token: tokenData.access_token as string | undefined,
    refresh_token: tokenData.refresh_token as string | undefined,
    expires_at: tokenData.expires_in
      ? Math.floor(Date.now() / 1000) + (tokenData.expires_in as number)
      : undefined,
    token_type: tokenData.token_type as string | undefined,
    scope: tokenData.scope as string | undefined,
    id_token: tokenData.id_token as string | undefined,
  };

  // signIn callback
  if (config.callbacks.signIn) {
    const result = await config.callbacks.signIn({ user, account, profile: rawProfile });
    if (result === false) {
      const errorUrl = new URL(`${config.baseUrl}${config.pages.error}`);
      errorUrl.searchParams.set("error", "AccessDenied");
      return Response.redirect(errorUrl.toString(), 302);
    }
    if (typeof result === "string") {
      return Response.redirect(result, 302);
    }
  }

  // Build JWT and session
  const jwtPayload = await buildJWT(user, account, rawProfile, config);
  const sessionToken = await encodeSession(jwtPayload, config);
  const session = await buildSession(jwtPayload, config);

  // Redirect destination
  const callbackUrl = getCallbackUrl(request, config) ?? config.pages.newUser ?? "/";
  const redirectUrl = isAbsoluteUrl(callbackUrl)
    ? callbackUrl
    : `${config.baseUrl}${callbackUrl}`;

  const headers = new Headers();
  applySessionCookie(headers, sessionToken, config);
  clearStateCookie(headers, config);
  clearCallbackUrlCookie(headers, config);
  headers.set("Location", redirectUrl);

  if (config.debug) {
    console.log("[VinextAuth] Signed in:", session.user.email);
  }

  return new Response(null, { status: 302, headers });
}

function isAbsoluteUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}
