import type { VinextAuthConfig, VinextAuthHandlers, PagesRequest, PagesResponse, CredentialsProvider, Session } from "../types.js";
import { resolveConfig, resolveBaseUrl } from "../core/config.js";
import { getSessionFromToken } from "../core/session.js";
import { renderSignInPage, renderErrorPage } from "../pages/index.js";
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

  async function auth<T = TSession>(): Promise<Session<T> | null> {
    let token: string | null = null;
    try {
      const { cookies } = await import("next/headers");
      const store = await cookies();
      const secureName = `__Secure-${resolved.cookies.sessionToken.name.replace("__Secure-", "")}`;
      token =
        store.get(secureName)?.value ??
        store.get(resolved.cookies.sessionToken.name)?.value ??
        null;
    } catch {
      return null;
    }
    if (!token) return null;
    return getSessionFromToken<T>(token, resolved);
  }

  function toPages(): (req: PagesRequest, res: PagesResponse) => Promise<void> {
    return async (req, res) => {
      const host = (req.headers["host"] as string | undefined) ?? "localhost";
      const protocol = host.startsWith("localhost") || /^127\./.test(host) ? "http" : "https";
      const url = new URL(req.url ?? "/", `${protocol}://${host}`);

      // Reconstruct headers, flattening any multi-value entries
      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (val === undefined) continue;
        if (Array.isArray(val)) {
          for (const v of val) headers.append(key, v);
        } else {
          headers.set(key, val);
        }
      }

      // Serialize body for POST: support both JSON and form-encoded payloads
      let body: string | undefined;
      if (req.method !== "GET" && req.method !== "HEAD" && req.body != null) {
        if (typeof req.body === "string") {
          body = req.body;
        } else {
          body = JSON.stringify(req.body);
          if (!headers.has("content-type")) {
            headers.set("content-type", "application/json");
          }
        }
      }

      const request = new Request(url, { method: req.method ?? "GET", headers, body });
      const response = await handler(request);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.send(await response.text());
    };
  }

  async function pagesAuth<T = TSession>(req: PagesRequest): Promise<Session<T> | null> {
    const secureName = `__Secure-${resolved.cookies.sessionToken.name.replace("__Secure-", "")}`;
    const token = req.cookies[secureName] ?? req.cookies[resolved.cookies.sessionToken.name] ?? null;
    if (!token) return null;
    return getSessionFromToken<T>(token, resolved);
  }

  return { GET: handler, POST: handler, auth, toPages, pagesAuth };
}

async function handleSignInPage(
  config: ReturnType<typeof resolveConfig>,
  request: Request
): Promise<Response> {
  const baseUrl = await resolveBaseUrl(config, request);
  const rawCallbackUrl = new URL(request.url).searchParams.get("callbackUrl") ?? "/";
  const callbackUrl = sanitizeRedirectUrl(rawCallbackUrl, baseUrl);

  const providers = config.providers.map((p) => ({
    id: p.id,
    name: p.name,
    signinUrl: `${baseUrl}${config.basePath}/signin/${p.id}`,
  }));

  return new Response(renderSignInPage(providers, callbackUrl, config.theme), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; img-src 'self' https: data:; script-src 'none'; frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function handleErrorPage(url: URL, config: ReturnType<typeof resolveConfig>): Response {
  const error = url.searchParams.get("error") ?? "Unknown";
  const retryAfter = url.searchParams.get("retryAfter") ?? null;

  return new Response(renderErrorPage(error, retryAfter, config.pages.signIn, config.theme), {
    status: 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; img-src 'none'; script-src 'none'; frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Returns a safe redirect URL restricted to the app's own origin. */
function sanitizeRedirectUrl(url: string, baseUrl: string): string {
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const redirect = new URL(url);
    const base = new URL(baseUrl);
    if (redirect.origin === base.origin) return url;
  } catch {
    // fall through
  }
  return "/";
}

export default VinextAuth;
