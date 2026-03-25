import * as react_jsx_runtime from 'react/jsx-runtime';
import { ReactNode } from 'react';
import { S as Session, j as SignInOptions, k as SignOutOptions, g as SessionContextValue } from '../types-G_m6Z3Iz.js';

interface SessionProviderProps {
    children: ReactNode;
    /** Pass server-side session to avoid client waterfall */
    session?: Session | null;
    basePath?: string;
    refetchInterval?: number;
    refetchOnWindowFocus?: boolean;
}
declare function SessionProvider({ children, session: initialSession, basePath, refetchInterval, refetchOnWindowFocus, }: SessionProviderProps): react_jsx_runtime.JSX.Element;

declare function useSession(): SessionContextValue;
/**
 * signIn — redirect to OAuth provider or sign-in page.
 *
 * Usage (identical to NextAuth v4):
 * ```ts
 * signIn("google")
 * signIn("google", { callbackUrl: "/dashboard" })
 * signIn() // goes to /api/auth/signin (provider list)
 * ```
 */
declare function signIn(provider?: string, options?: SignInOptions, basePath?: string): void;
/**
 * signOut — POST to signout endpoint, then redirect.
 *
 * Usage (identical to NextAuth v4):
 * ```ts
 * signOut()
 * signOut({ callbackUrl: "/login" })
 * ```
 */
declare function signOut(options?: SignOutOptions, basePath?: string): Promise<void>;

export { SessionContextValue, SessionProvider, SignInOptions, SignOutOptions, signIn, signOut, useSession };
