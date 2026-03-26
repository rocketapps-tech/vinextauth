'use client';

import { useSessionContext, fetchCsrfToken } from './context.js';
import type { SessionContextValue, SignInOptions, SignOutOptions } from '../types.js';

export function useSession(): SessionContextValue {
  return useSessionContext();
}

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
export function signIn(provider?: string, options?: SignInOptions, basePath = '/api/auth'): void {
  const callbackUrl = options?.callbackUrl ?? window.location.href;

  if (provider) {
    const url = `${basePath}/signin/${provider}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    window.location.href = url;
  } else {
    window.location.href = `${basePath}/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }
}

/**
 * signOut — POST to signout endpoint, then redirect.
 *
 * Usage (identical to NextAuth v4):
 * ```ts
 * signOut()
 * signOut({ callbackUrl: "/login" })
 * ```
 */
export async function signOut(options?: SignOutOptions, basePath = '/api/auth'): Promise<void> {
  const callbackUrl = options?.callbackUrl ?? window.location.origin;

  const csrfToken = await fetchCsrfToken(basePath);

  await fetch(`${basePath}/signout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ csrfToken, callbackUrl }),
  });

  window.location.href = callbackUrl;
}
