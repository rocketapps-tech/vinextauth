// src/cookies/strategy.ts
var SESSION_TOKEN_COOKIE = "vinextauth.session-token";
var CALLBACK_URL_COOKIE = "vinextauth.callback-url";
var CSRF_TOKEN_COOKIE = "vinextauth.csrf-token";
var STATE_COOKIE = "vinextauth.state";
var NONCE_COOKIE = "vinextauth.nonce";
var SECURE_PREFIX = "__Secure-";
function buildCookieNames(useSecure) {
  const prefix = useSecure ? SECURE_PREFIX : "";
  return {
    sessionToken: {
      name: `${prefix}${SESSION_TOKEN_COOKIE}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure
      }
    },
    callbackUrl: {
      name: `${prefix}${CALLBACK_URL_COOKIE}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure
      }
    },
    csrfToken: {
      name: `${CSRF_TOKEN_COOKIE}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure
      }
    },
    state: {
      name: `${prefix}${STATE_COOKIE}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure,
        maxAge: 60 * 15
        // 15 minutes
      }
    },
    nonce: {
      name: `${prefix}${NONCE_COOKIE}`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecure,
        maxAge: 60 * 15
      }
    }
  };
}
function serializeCookie(name, value, options) {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (options.httpOnly) cookie += "; HttpOnly";
  if (options.secure) cookie += "; Secure";
  if (options.sameSite) cookie += `; SameSite=${capitalize(options.sameSite)}`;
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.maxAge !== void 0) cookie += `; Max-Age=${options.maxAge}`;
  if (options.domain) cookie += `; Domain=${options.domain}`;
  return cookie;
}
function deleteCookieString(name, options) {
  return serializeCookie(name, "", { ...options, maxAge: 0 });
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// src/core/config.ts
var DEFAULT_MAX_AGE = 30 * 24 * 60 * 60;
function resolveConfig(config) {
  const secret = config.secret ?? (typeof process !== "undefined" ? process.env.NEXTAUTH_SECRET ?? process.env.VINEXTAUTH_SECRET : void 0);
  if (!secret) {
    throw new Error(
      "[VinextAuth] No secret provided. Set NEXTAUTH_SECRET or VINEXTAUTH_SECRET env var, or pass `secret` to VinextAuth()."
    );
  }
  const baseUrl = (typeof process !== "undefined" ? process.env.NEXTAUTH_URL ?? process.env.VINEXTAUTH_URL ?? process.env.VERCEL_URL : void 0) ?? "http://localhost:3000";
  const normalizedBaseUrl = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const useSecureCookies = config.useSecureCookies ?? normalizedBaseUrl.startsWith("https://");
  const sessionMaxAge = config.session?.maxAge ?? DEFAULT_MAX_AGE;
  return {
    providers: config.providers,
    secret,
    baseUrl: normalizedBaseUrl,
    basePath: "/api/auth",
    callbacks: config.callbacks ?? {},
    pages: {
      signIn: "/api/auth/signin",
      signOut: "/api/auth/signout",
      error: "/api/auth/error",
      verifyRequest: "/api/auth/verify-request",
      newUser: "/",
      ...config.pages
    },
    session: {
      strategy: config.session?.strategy ?? "jwt",
      maxAge: sessionMaxAge,
      updateAge: config.session?.updateAge ?? 24 * 60 * 60
    },
    jwt: {
      secret,
      maxAge: sessionMaxAge,
      encode: config.jwt?.encode,
      decode: config.jwt?.decode
    },
    debug: config.debug ?? false,
    useSecureCookies,
    cookies: {
      ...buildCookieNames(useSecureCookies),
      ...config.cookies
    },
    adapter: config.adapter
  };
}

// src/cookies/index.ts
function getSessionToken(request, config) {
  return getCookieValue(request, config.cookies.sessionToken.name);
}
function getCallbackUrl(request, config) {
  return getCookieValue(request, config.cookies.callbackUrl.name);
}
function getCsrfCookie(request, config) {
  return getCookieValue(request, config.cookies.csrfToken.name);
}
function getStateCookie(request, config) {
  return getCookieValue(request, config.cookies.state.name);
}
function getCookieValue(request, name) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...val] = part.trim().split("=");
    if (key.trim() === name) {
      return decodeURIComponent(val.join("="));
    }
  }
  return null;
}
function applySessionCookie(headers, token, config) {
  const { name, options } = config.cookies.sessionToken;
  headers.append(
    "Set-Cookie",
    serializeCookie(name, token, { ...options, maxAge: config.session.maxAge })
  );
}
function applyCallbackUrlCookie(headers, url, config) {
  const { name, options } = config.cookies.callbackUrl;
  headers.append("Set-Cookie", serializeCookie(name, url, { ...options, maxAge: 60 * 10 }));
}
function applyCsrfCookie(headers, value, config) {
  const { name, options } = config.cookies.csrfToken;
  headers.append("Set-Cookie", serializeCookie(name, value, options));
}
function applyStateCookie(headers, state, config) {
  const { name, options } = config.cookies.state;
  headers.append("Set-Cookie", serializeCookie(name, state, options));
}
function clearSessionCookie(headers, config) {
  const { name, options } = config.cookies.sessionToken;
  headers.append("Set-Cookie", deleteCookieString(name, options));
}
function clearStateCookie(headers, config) {
  const { name, options } = config.cookies.state;
  headers.append("Set-Cookie", deleteCookieString(name, options));
}
function clearCallbackUrlCookie(headers, config) {
  const { name, options } = config.cookies.callbackUrl;
  headers.append("Set-Cookie", deleteCookieString(name, options));
}
function sessionToExpires(maxAge) {
  return new Date(Date.now() + maxAge * 1e3).toISOString();
}
function buildSessionFromJWT(jwt, maxAge) {
  return {
    user: {
      id: jwt.sub ?? "",
      name: jwt.name ?? null,
      email: jwt.email ?? null,
      image: jwt.picture ?? null
    },
    expires: sessionToExpires(maxAge)
  };
}

// src/handlers/signin.ts
function randomBase64url(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  const binary = String.fromCharCode(...arr);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function handleSignIn(request, providerId, config) {
  const provider = config.providers.find((p) => p.id === providerId);
  if (!provider) {
    return new Response(`Unknown provider: ${providerId}`, { status: 404 });
  }
  const url = new URL(request.url);
  const callbackUrl = url.searchParams.get("callbackUrl") ?? config.pages.newUser ?? "/";
  const state = randomBase64url(32);
  const redirectUri = `${config.baseUrl}${config.basePath}/callback/${providerId}`;
  const authUrl = new URL(provider.authorization.url);
  authUrl.searchParams.set("client_id", provider.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  const params = provider.authorization.params ?? {};
  for (const [key, value] of Object.entries(params)) {
    authUrl.searchParams.set(key, value);
  }
  const headers = new Headers();
  applyStateCookie(headers, state, config);
  applyCallbackUrlCookie(headers, callbackUrl, config);
  headers.set("Location", authUrl.toString());
  return new Response(null, { status: 302, headers });
}

// src/jwt/keys.ts
var keyCache = /* @__PURE__ */ new Map();
async function deriveKey(secret) {
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  keyCache.set(secret, key);
  return key;
}

// src/jwt/index.ts
function base64urlEncode(data) {
  const bytes = new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function base64urlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
function encodeJson(obj) {
  return base64urlEncode(new TextEncoder().encode(JSON.stringify(obj)).buffer);
}
function decodeJson(str) {
  return JSON.parse(new TextDecoder().decode(base64urlDecode(str)));
}
var HEADER = encodeJson({ alg: "HS256", typ: "JWT" });
async function sign(payload, secret) {
  const encodedPayload = encodeJson(payload);
  const message = `${HEADER}.${encodedPayload}`;
  const key = await deriveKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return `${message}.${base64urlEncode(signature)}`;
}
async function verify(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const message = `${header}.${payload}`;
    const key = await deriveKey(secret);
    const signatureBytes = base64urlDecode(sig);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(message)
    );
    if (!valid) return null;
    const decoded = decodeJson(payload);
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1e3)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// src/core/session.ts
async function encodeSession(payload, config) {
  if (config.jwt.encode) {
    return config.jwt.encode({
      token: payload,
      secret: config.secret,
      maxAge: config.session.maxAge
    });
  }
  return sign(payload, config.secret);
}
async function decodeSession(token, config) {
  if (config.jwt.decode) {
    return config.jwt.decode({ token, secret: config.secret });
  }
  return verify(token, config.secret);
}
async function buildSession(jwt, config) {
  const baseSession = buildSessionFromJWT(jwt, config.session.maxAge);
  if (config.callbacks.session) {
    return config.callbacks.session({ session: baseSession, token: jwt });
  }
  return baseSession;
}
async function buildJWT(user, account, profile, config) {
  const now = Math.floor(Date.now() / 1e3);
  let token = {
    sub: user.id,
    name: user.name,
    email: user.email,
    picture: user.image,
    iat: now,
    exp: now + config.session.maxAge,
    jti: generateId()
  };
  if (config.callbacks.jwt) {
    token = await config.callbacks.jwt({
      token,
      user,
      account,
      profile,
      trigger: "signIn"
    });
  }
  return token;
}
function generateId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// src/handlers/callback.ts
async function handleCallback(request, providerId, config) {
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
  const storedState = getStateCookie(request, config);
  if (provider.checks?.includes("state")) {
    if (!storedState || storedState !== stateParam) {
      const errorUrl = new URL(`${config.baseUrl}${config.pages.error}`);
      errorUrl.searchParams.set("error", "OAuthStateError");
      return Response.redirect(errorUrl.toString(), 302);
    }
  }
  const redirectUri = `${config.baseUrl}${config.basePath}/callback/${providerId}`;
  let tokenData;
  try {
    const tokenResponse = await fetch(provider.token.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: provider.clientId,
        client_secret: provider.clientSecret
      }).toString()
    });
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }
    tokenData = await tokenResponse.json();
  } catch (err) {
    if (config.debug) console.error("[VinextAuth] Token exchange error:", err);
    const errorUrl = new URL(`${config.baseUrl}${config.pages.error}`);
    errorUrl.searchParams.set("error", "OAuthCallbackError");
    return Response.redirect(errorUrl.toString(), 302);
  }
  let rawProfile;
  try {
    const userInfoResponse = await fetch(provider.userinfo.url, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json"
      }
    });
    if (!userInfoResponse.ok) {
      throw new Error(`UserInfo fetch failed: ${userInfoResponse.status}`);
    }
    rawProfile = await userInfoResponse.json();
  } catch (err) {
    if (config.debug) console.error("[VinextAuth] UserInfo error:", err);
    const errorUrl = new URL(`${config.baseUrl}${config.pages.error}`);
    errorUrl.searchParams.set("error", "OAuthCallbackError");
    return Response.redirect(errorUrl.toString(), 302);
  }
  const user = provider.profile(rawProfile);
  const account = {
    provider: providerId,
    type: "oauth",
    providerAccountId: user.id,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: tokenData.expires_in ? Math.floor(Date.now() / 1e3) + tokenData.expires_in : void 0,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
    id_token: tokenData.id_token
  };
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
  const jwtPayload = await buildJWT(user, account, rawProfile, config);
  const sessionToken = await encodeSession(jwtPayload, config);
  const session = await buildSession(jwtPayload, config);
  const callbackUrl = getCallbackUrl(request, config) ?? config.pages.newUser ?? "/";
  const redirectUrl = isAbsoluteUrl(callbackUrl) ? callbackUrl : `${config.baseUrl}${callbackUrl}`;
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
function isAbsoluteUrl(url) {
  return url.startsWith("http://") || url.startsWith("https://");
}

// src/core/csrf.ts
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}
async function hmacHex(secret, value) {
  const key = await deriveKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(sig));
}
async function generateCsrfToken(secret) {
  const token = randomHex(32);
  const hash = await hmacHex(secret, token);
  return { token, cookieValue: `${token}|${hash}` };
}
async function verifyCsrfToken(submittedToken, cookieValue, secret) {
  const [storedToken] = cookieValue.split("|");
  if (storedToken !== submittedToken) return false;
  const expectedHash = await hmacHex(secret, storedToken);
  const expectedCookieValue = `${storedToken}|${expectedHash}`;
  if (cookieValue.length !== expectedCookieValue.length) return false;
  let diff = 0;
  for (let i = 0; i < cookieValue.length; i++) {
    diff |= cookieValue.charCodeAt(i) ^ expectedCookieValue.charCodeAt(i);
  }
  return diff === 0;
}

// src/handlers/signout.ts
async function handleSignOut(request, config) {
  let callbackUrl = config.baseUrl;
  if (request.method === "POST") {
    let body = {};
    try {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        body = await request.json();
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await request.text();
        body = Object.fromEntries(new URLSearchParams(text));
      }
    } catch {
    }
    const csrfCookie = getCsrfCookie(request, config);
    const submittedToken = body.csrfToken ?? "";
    if (csrfCookie) {
      const valid = await verifyCsrfToken(submittedToken, csrfCookie, config.secret);
      if (!valid && config.debug) {
        console.warn("[VinextAuth] CSRF verification failed on signout");
      }
    }
    callbackUrl = body.callbackUrl ?? config.baseUrl;
  }
  const headers = new Headers();
  clearSessionCookie(headers, config);
  clearCallbackUrlCookie(headers, config);
  const redirectUrl = isAbsoluteUrl2(callbackUrl) ? callbackUrl : `${config.baseUrl}${callbackUrl}`;
  headers.set("Location", redirectUrl);
  return new Response(null, { status: 302, headers });
}
function isAbsoluteUrl2(url) {
  return url.startsWith("http://") || url.startsWith("https://");
}

// src/handlers/session-route.ts
async function handleSessionRoute(request, config) {
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
      "Cache-Control": "no-store, max-age=0"
    }
  });
}

// src/handlers/csrf-route.ts
async function handleCsrfRoute(request, config) {
  const existing = getCsrfCookie(request, config);
  if (existing) {
    const token2 = existing.split("|")[0];
    return Response.json({ csrfToken: token2 });
  }
  const { token, cookieValue } = await generateCsrfToken(config.secret);
  const headers = new Headers();
  applyCsrfCookie(headers, cookieValue, config);
  return Response.json({ csrfToken: token }, { headers });
}
function VinextAuth(config) {
  const resolved = resolveConfig(config);
  async function handler(request) {
    const url = new URL(request.url);
    const basePath = resolved.basePath;
    const pathname = url.pathname;
    if (!pathname.startsWith(basePath)) {
      return new Response("Not Found", { status: 404 });
    }
    const action = pathname.slice(basePath.length).replace(/^\//, "");
    const parts = action.split("/");
    const verb = parts[0];
    const param = parts[1];
    if (verb === "signin" && param) {
      return handleSignIn(request, param, resolved);
    }
    if (verb === "signin" && !param) {
      return handleSignInPage(resolved);
    }
    if (verb === "callback" && param) {
      return handleCallback(request, param, resolved);
    }
    if (verb === "signout") {
      if (request.method === "POST") {
        return handleSignOut(request, resolved);
      }
      return handleSignOut(request, resolved);
    }
    if (verb === "session") {
      return handleSessionRoute(request, resolved);
    }
    if (verb === "csrf") {
      return handleCsrfRoute(request, resolved);
    }
    if (verb === "error") {
      const error = url.searchParams.get("error") ?? "Unknown";
      return new Response(
        `<!DOCTYPE html><html><body><h1>Authentication Error</h1><p>${error}</p><a href="${resolved.pages.signIn}">Try again</a></body></html>`,
        { status: 400, headers: { "Content-Type": "text/html" } }
      );
    }
    return new Response("Not Found", { status: 404 });
  }
  return { GET: handler, POST: handler };
}
function handleSignInPage(config) {
  const providers = config.providers.map((p) => `
    <a href="${config.basePath}/signin/${p.id}" style="display:block;margin:8px 0;padding:12px 24px;border:1px solid #ccc;border-radius:6px;text-decoration:none;color:#000;">
      Sign in with ${p.name}
    </a>
  `).join("");
  return new Response(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:400px;margin:80px auto;padding:24px">
      <h1>Sign In</h1>${providers}
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export { VinextAuth, VinextAuth as default };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map