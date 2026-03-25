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
encodeJson({ alg: "HS256", typ: "JWT" });
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

// src/cookies/index.ts
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

// src/core/session.ts
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

// src/handlers/index.ts
var _resolvedConfig = null;
function getResolvedConfig() {
  return _resolvedConfig;
}

// src/server/index.ts
async function getServerSession(config) {
  const resolved = config ? resolveConfig(config) : getResolvedConfig();
  if (!resolved) {
    console.warn(
      "[VinextAuth] getServerSession called before VinextAuth() was initialized. Pass authOptions directly: getServerSession(authOptions)"
    );
    return null;
  }
  let token = null;
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const secureName = `__Secure-${resolved.cookies.sessionToken.name.replace("__Secure-", "")}`;
    token = cookieStore.get(secureName)?.value ?? cookieStore.get(resolved.cookies.sessionToken.name)?.value ?? null;
  } catch {
    return null;
  }
  if (!token) return null;
  const jwt = await decodeSession(token, resolved);
  if (!jwt) return null;
  return buildSession(jwt, resolved);
}
async function auth() {
  return getServerSession();
}

export { auth, getServerSession, getServerSession as getSession };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map