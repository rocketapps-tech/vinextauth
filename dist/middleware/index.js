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

// src/cookies/strategy.ts
var SESSION_TOKEN_COOKIE = "vinextauth.session-token";

// src/middleware/index.ts
function getNextResponse() {
  return {
    redirect: (url, status = 302) => new Response(null, { status, headers: { Location: url.toString() } }),
    next: () => void 0
  };
}
function withAuth(middlewareOrOptions, options) {
  let innerMiddleware;
  let opts;
  if (typeof middlewareOrOptions === "function") {
    innerMiddleware = middlewareOrOptions;
    opts = options ?? {};
  } else {
    opts = middlewareOrOptions ?? {};
  }
  const signInPage = opts.pages?.signIn ?? "/api/auth/signin";
  return async (request) => {
    const secret = opts.secret ?? (typeof process !== "undefined" ? process.env.NEXTAUTH_SECRET ?? process.env.VINEXTAUTH_SECRET : void 0);
    if (!secret) {
      console.error("[VinextAuth] withAuth: No secret configured.");
      return getNextResponse().redirect(signInPage);
    }
    const token = getTokenFromRequest(request);
    let jwt = null;
    if (token) {
      jwt = await verify(token, secret);
    }
    if (opts.callbacks?.authorized) {
      const authorized = await opts.callbacks.authorized({ token: jwt, req: request });
      if (!authorized) {
        return redirectToSignIn(request, signInPage);
      }
    } else {
      if (!jwt) {
        return redirectToSignIn(request, signInPage);
      }
    }
    if (innerMiddleware) {
      return innerMiddleware(request);
    }
    return getNextResponse().next();
  };
}
function getTokenFromRequest(request) {
  if (request.cookies?.get) {
    const secure = request.cookies.get(`__Secure-${SESSION_TOKEN_COOKIE}`)?.value;
    if (secure) return secure;
    const plain = request.cookies.get(SESSION_TOKEN_COOKIE)?.value;
    if (plain) return plain;
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...val] = part.trim().split("=");
    const name = key.trim();
    if (name === `__Secure-${SESSION_TOKEN_COOKIE}` || name === SESSION_TOKEN_COOKIE) {
      return decodeURIComponent(val.join("="));
    }
  }
  return null;
}
function redirectToSignIn(request, signInPage) {
  const url = request.nextUrl ?? new URL(request.url);
  const callbackUrl = url.pathname + url.search;
  const redirectUrl = `${signInPage}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl }
  });
}
var middleware_default = withAuth;

export { middleware_default as default, withAuth };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map