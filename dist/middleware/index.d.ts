import { W as WithAuthOptions } from '../types-G_m6Z3Iz.js';

type NextRequest = Request & {
    cookies?: {
        get?: (name: string) => {
            value: string;
        } | undefined;
    };
    nextUrl?: URL;
};
type NextMiddlewareResult = Response | null | undefined;
type NextMiddleware = (request: NextRequest) => NextMiddlewareResult | Promise<NextMiddlewareResult>;
/**
 * withAuth — Edge-compatible middleware, drop-in for NextAuth's withAuth.
 *
 * Usage (identical to NextAuth v4):
 * ```ts
 * export default withAuth({ pages: { signIn: "/login" } })
 * export const config = { matcher: ["/dashboard/:path*"] }
 * ```
 */
declare function withAuth(middlewareOrOptions?: NextMiddleware | WithAuthOptions, options?: WithAuthOptions): NextMiddleware;

export { withAuth as default, withAuth };
