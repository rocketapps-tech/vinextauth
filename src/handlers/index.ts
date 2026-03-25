import type { VinextAuthConfig, VinextAuthHandlers, CredentialsProvider } from "../types.js";
import { resolveConfig, resolveBaseUrl } from "../core/config.js";
import { handleSignIn } from "./signin.js";
import { handleCallback } from "./callback.js";
import { handleSignOut } from "./signout.js";
import { handleSessionRoute } from "./session-route.js";
import { handleCsrfRoute } from "./csrf-route.js";
import { handleCredentials } from "./credentials.js";

// Module-level config for server-side helpers (getServerSession)
let _resolvedConfig: ReturnType<typeof resolveConfig> | null = null;

export function getResolvedConfig() {
  return _resolvedConfig;
}

/**
 * VinextAuth — main factory function.
 *
 * Generics let you type your custom session and token fields without
 * module augmentation (unlike NextAuth).
 *
 * @example
 * ```ts
 * // With custom types — no module augmentation needed
 * const handler = VinextAuth<{ role: "admin" | "user" }, { role: string }>({
 *   providers: [GoogleProvider({ clientId, clientSecret })],
 *   callbacks: {
 *     jwt({ token, user }) {
 *       if (user) token.role = user.role  // TypeScript knows this!
 *       return token
 *     },
 *     session({ session, token }) {
 *       session.user.role = token.role    // Fully typed
 *       return session
 *     }
 *   }
 * })
 * export { handler as GET, handler as POST }
 * ```
 */
export function VinextAuth<TSession = {}, TToken = {}, TUser = {}>(
  config: VinextAuthConfig<TSession, TToken, TUser>
): VinextAuthHandlers {
  const resolved = resolveConfig(config as unknown as VinextAuthConfig);
  _resolvedConfig = resolved;

  async function handler(request: Request): Promise<Response> {
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

    if (resolved.debug) {
      console.log(`[VinextAuth] ${request.method} ${pathname} → ${verb}/${param ?? ""}`);
    }

    // OAuth signin redirect
    if (verb === "signin" && param) {
      const provider = resolved.providers.find((p) => p.id === param);
      if (provider?.type === "credentials") {
        return handleCredentials(request, provider as CredentialsProvider, resolved);
      }
      return handleSignIn(request, param, resolved);
    }

    // Built-in signin page
    if (verb === "signin" && !param) {
      return handleSignInPage(resolved, request);
    }

    // OAuth callback
    if (verb === "callback" && param) {
      return handleCallback(request, param, resolved);
    }

    // Sign out
    if (verb === "signout") {
      return handleSignOut(request, resolved);
    }

    // Session endpoint (used by React client)
    if (verb === "session") {
      return handleSessionRoute(request, resolved);
    }

    // CSRF token
    if (verb === "csrf") {
      return handleCsrfRoute(request, resolved);
    }

    // Providers list (for debugging / discovery)
    if (verb === "providers") {
      const providers = resolved.providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        signinUrl: `${resolved.basePath}/signin/${p.id}`,
        callbackUrl: p.type === "oauth" ? `${resolved.basePath}/callback/${p.id}` : null,
      }));
      return Response.json(providers);
    }

    // Error page
    if (verb === "error") {
      return handleErrorPage(url, resolved);
    }

    return new Response("Not Found", { status: 404 });
  }

  return { GET: handler, POST: handler };
}

async function handleSignInPage(
  config: ReturnType<typeof resolveConfig>,
  request: Request
): Promise<Response> {
  const baseUrl = await resolveBaseUrl(config, request);
  const callbackUrl = new URL(request.url).searchParams.get("callbackUrl") ?? "/";

  const providers = config.providers
    .map(
      (p) => `
    <a href="${baseUrl}${config.basePath}/signin/${p.id}?callbackUrl=${encodeURIComponent(callbackUrl)}"
       style="display:flex;align-items:center;gap:8px;margin:8px 0;padding:12px 20px;
              border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;color:#1a202c;
              font-weight:500;transition:background 0.15s;"
       onmouseover="this.style.background='#f7fafc'" onmouseout="this.style.background=''">
      Sign in with ${p.name}
    </a>`
    )
    .join("");

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sign In</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f7fafc; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 12px; padding: 32px 40px;
            box-shadow: 0 1px 3px rgba(0,0,0,.1); width: 100%; max-width: 380px; }
    h1 { margin: 0 0 24px; font-size: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign In</h1>
    ${providers}
  </div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

function handleErrorPage(url: URL, config: ReturnType<typeof resolveConfig>): Response {
  const error = url.searchParams.get("error") ?? "Unknown";
  const retryAfter = url.searchParams.get("retryAfter");

  const messages: Record<string, string> = {
    OAuthAccountNotLinked:
      "This email is already associated with another account. Enable account linking or sign in with your original provider.",
    OAuthCallbackError: "Authentication failed. Please try again.",
    OAuthStateError: "Authentication state mismatch. Please try again.",
    AccessDenied: "You do not have permission to sign in.",
    RateLimitExceeded: `Too many sign-in attempts. Please wait${retryAfter ? ` ${retryAfter} seconds` : ""} before trying again.`,
    InvalidCredentials: "Invalid email or password.",
    SessionExpired: "Your session has expired. Please sign in again.",
    Configuration: "Server configuration error.",
    Unknown: "An unexpected error occurred.",
  };

  const message = messages[error] ?? messages.Unknown;

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authentication Error</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f7fafc; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 12px; padding: 32px 40px;
            box-shadow: 0 1px 3px rgba(0,0,0,.1); width: 100%; max-width: 420px; text-align: center; }
    h1 { color: #e53e3e; margin-bottom: 12px; }
    p { color: #4a5568; line-height: 1.6; }
    a { display:inline-block; margin-top:20px; padding:10px 24px;
        background:#3182ce; color:white; border-radius:6px; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authentication Error</h1>
    <p>${message}</p>
    <a href="${config.pages.signIn}">Try again</a>
  </div>
</body>
</html>`,
    { status: 400, headers: { "Content-Type": "text/html" } }
  );
}

export default VinextAuth;
