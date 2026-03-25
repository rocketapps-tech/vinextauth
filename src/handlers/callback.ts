import type { ResolvedConfig, SignInCallbackParams, OAuthProvider } from "../types.js";
import {
  getStateCookie,
  getCallbackUrl,
  applySessionCookie,
  clearStateCookie,
  clearCallbackUrlCookie,
} from "../cookies/index.js";
import { buildJWT, buildSession, encodeSession } from "../core/session.js";
import { resolveBaseUrl } from "../core/config.js";

export async function handleCallback(
  request: Request,
  providerId: string,
  config: ResolvedConfig
): Promise<Response> {
  const provider = config.providers.find(
    (p) => p.id === providerId && p.type === "oauth"
  ) as OAuthProvider | undefined;

  if (!provider) return new Response("Unknown provider", { status: 404 });

  const baseUrl = await resolveBaseUrl(config, request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const errorBase = `${baseUrl}${config.pages.error}`;

  if (error) {
    return Response.redirect(`${errorBase}?error=${encodeURIComponent(error)}`, 302);
  }

  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  // ── Verify state ─────────────────────────────────────────────────────────
  const storedState = getStateCookie(request, config);
  if (provider.checks?.includes("state")) {
    if (!storedState || storedState !== stateParam) {
      return Response.redirect(`${errorBase}?error=OAuthStateError`, 302);
    }
  }

  // ── Exchange code for tokens ──────────────────────────────────────────────
  const redirectUri = `${baseUrl}${config.basePath}/callback/${providerId}`;
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
    return Response.redirect(`${errorBase}?error=OAuthCallbackError`, 302);
  }

  // ── Fetch user profile ───────────────────────────────────────────────────
  let rawProfile: Record<string, unknown>;
  try {
    const userInfoResponse = await fetch(provider.userinfo.url, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
        // GitHub needs this header
        "User-Agent": "VinextAuth/0.2",
      },
    });

    if (!userInfoResponse.ok) throw new Error(`UserInfo failed: ${userInfoResponse.status}`);
    rawProfile = await userInfoResponse.json() as Record<string, unknown>;
  } catch (err) {
    if (config.debug) console.error("[VinextAuth] UserInfo error:", err);
    return Response.redirect(`${errorBase}?error=OAuthCallbackError`, 302);
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

  // ── Account linking ───────────────────────────────────────────────────────
  if (config.adapter?.getAccountByProvider) {
    const existingAccount = await config.adapter.getAccountByProvider(providerId, user.id);

    if (!existingAccount && user.email && config.adapter.getUserByEmail) {
      const existingUser = await config.adapter.getUserByEmail(user.email);

      if (existingUser) {
        if (!config.accountLinking.enabled) {
          // Unlike NextAuth, we give a clear error message instead of a cryptic one
          return Response.redirect(
            `${errorBase}?error=OAuthAccountNotLinked&provider=${providerId}&hint=enableAccountLinking`,
            302
          );
        }

        // Safe account linking — link to existing user
        if (config.adapter.linkAccount) {
          await config.adapter.linkAccount(existingUser.id, providerId, user.id);
        }
        // Use existing user data
        user.id = existingUser.id;
        user.name = user.name ?? existingUser.name;
        user.image = user.image ?? existingUser.image;
      }
    }
  }

  // ── signIn callback ───────────────────────────────────────────────────────
  if (config.callbacks.signIn) {
    const result = await config.callbacks.signIn({ user, account, profile: rawProfile });
    if (result === false) {
      return Response.redirect(`${errorBase}?error=AccessDenied`, 302);
    }
    if (typeof result === "string") {
      return Response.redirect(result, 302);
    }
  }

  // ── Build JWT and session ─────────────────────────────────────────────────
  const jwtPayload = await buildJWT(user, account, rawProfile, config);
  const sessionToken = await encodeSession(jwtPayload, config);

  const callbackUrl = getCallbackUrl(request, config) ?? config.pages.newUser ?? "/";
  const redirectUrl = isAbsoluteUrl(callbackUrl) ? callbackUrl : `${baseUrl}${callbackUrl}`;

  const headers = new Headers();
  applySessionCookie(headers, sessionToken, config);
  clearStateCookie(headers, config);
  clearCallbackUrlCookie(headers, config);
  headers.set("Location", redirectUrl);

  if (config.debug) {
    console.log("[VinextAuth] Signed in:", session(jwtPayload, config));
  }

  return new Response(null, { status: 302, headers });
}

function isAbsoluteUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function session(jwt: Record<string, unknown>, _config: ResolvedConfig): string {
  return `${jwt.email ?? jwt.sub ?? "unknown"}`;
}
