import { withAuth } from "vinextauth/middleware";

/**
 * proxy.ts — Edge proxy for route protection (Vinext equivalent of middleware.ts).
 *
 * withAuth redirects unauthenticated requests to the sign-in page (/)
 * with ?callbackUrl pointing back to the original page.
 */
export const proxy = withAuth({
  pages: {
    signIn: "/",
  },
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
