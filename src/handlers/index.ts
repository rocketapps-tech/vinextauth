import type { VinextAuthConfig, VinextAuthHandlers } from "../types.js";
import { resolveConfig } from "../core/config.js";
import { handleSignIn } from "./signin.js";
import { handleCallback } from "./callback.js";
import { handleSignOut } from "./signout.js";
import { handleSessionRoute } from "./session-route.js";
import { handleCsrfRoute } from "./csrf-route.js";

// Module-level config storage for server-side helpers (getServerSession)
let _resolvedConfig: ReturnType<typeof resolveConfig> | null = null;

export function getResolvedConfig() {
  return _resolvedConfig;
}

/**
 * VinextAuth — main factory function.
 *
 * Usage (identical to NextAuth v4):
 * ```ts
 * const handler = VinextAuth(authOptions)
 * export { handler as GET, handler as POST }
 * ```
 */
export function VinextAuth(config: VinextAuthConfig): VinextAuthHandlers {
  const resolved = resolveConfig(config);
  _resolvedConfig = resolved;

  async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Extract path segments after /api/auth/
    const basePath = resolved.basePath; // "/api/auth"
    const pathname = url.pathname;

    if (!pathname.startsWith(basePath)) {
      return new Response("Not Found", { status: 404 });
    }

    const action = pathname.slice(basePath.length).replace(/^\//, "");
    // action examples: "signin/google", "callback/google", "signout", "session", "csrf", "error"

    const parts = action.split("/");
    const verb = parts[0];
    const param = parts[1]; // provider id, if any

    // Route
    if (verb === "signin" && param) {
      return handleSignIn(request, param, resolved);
    }

    if (verb === "signin" && !param) {
      // Show built-in signin page (list providers)
      return handleSignInPage(resolved);
    }

    if (verb === "callback" && param) {
      return handleCallback(request, param, resolved);
    }

    if (verb === "signout") {
      if (request.method === "POST") {
        return handleSignOut(request, resolved);
      }
      // GET signout — show confirmation page or just do it
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

function handleSignInPage(config: ReturnType<typeof resolveConfig>): Response {
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

export default VinextAuth;
