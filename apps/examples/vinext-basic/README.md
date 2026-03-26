# vinext-basic — VinextAuth Example

Complete authentication example using [VinextAuth](https://vinext.io/) on the Vinext framework (Cloudflare Workers edge runtime). Demonstrates email/password credentials and OAuth (Google + GitHub), with a protected dashboard and secure sign-out.

## What this example covers

- Custom login page with email/password form and OAuth buttons
- CSRF protection on credentials login and sign-out
- Protected route (`/dashboard`) guarded at both the edge proxy and server-side
- Session reading in `getServerSideProps` without leaking auth code to the client bundle
- Sign-out with CSRF token via native form POST
- Redirect flows: authenticated users skip login, unauthenticated users are redirected to `/`

## Project structure

```
src/
├── auth.ts                          # VinextAuth config — providers, callbacks, pages
├── proxy.ts                         # Edge route protection (Vinext middleware)
└── pages/
    ├── _app.tsx                     # SessionProvider wrapper
    ├── index.tsx                    # Login page (credentials + OAuth)
    ├── dashboard.tsx                # Protected dashboard
    └── api/
        └── auth/
            └── [...vinextauth].ts   # Auth API route handler
```

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

```env
# Required — generate with: openssl rand -base64 32
VINEXTAUTH_SECRET=your-secret-here

# Required — your app's public URL
VINEXTAUTH_URL=http://localhost:3002

# Optional — only needed if using Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Optional — only needed if using GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

**Demo credentials:** `demo@example.com` / `password123`

## How authentication works

### auth.ts — central config

All VinextAuth configuration lives in `src/auth.ts`. It exports the handlers and helpers used by the rest of the app:

```ts
export const { GET, POST, auth, toPages, pagesAuth } = VinextAuth(config);
```

| Export | Used by |
|---|---|
| `GET`, `POST` | `pages/api/auth/[...vinextauth].ts` |
| `toPages` | `pages/api/auth/[...vinextauth].ts` |
| `pagesAuth` | `getServerSideProps` in any page that needs the session |

### API route — `pages/api/auth/[...vinextauth].ts`

A single catch-all route handles all auth endpoints:

```
GET  /api/auth/csrf                      → returns CSRF token + sets cookie
GET  /api/auth/session                   → returns current session
GET  /api/auth/signin                    → built-in sign-in page (not used by this example)
POST /api/auth/callback/credentials      → validates credentials + issues session cookie
GET  /api/auth/callback/:provider        → OAuth callback (code exchange)
POST /api/auth/signout                   → clears session cookie
```

### Credentials login flow

```
Browser                         Server
  │                               │
  ├─ GET /api/auth/csrf ─────────►│ generates token|hmac, sets HttpOnly cookie
  │◄── { csrfToken } + Set-Cookie─┤
  │                               │
  │  (user fills form)            │
  │                               │
  ├─ POST /api/auth/callback/credentials
  │   body: csrfToken, email, password, callbackUrl
  │   cookie: vinextauth.csrf-token
  │                               │
  │                          verifies CSRF (body token vs cookie hmac)
  │                          calls authorize()
  │                          issues JWT session cookie
  │◄── 302 → /dashboard ─────────┤
```

**Why fetch CSRF via `useEffect`?**

The Vinext edge runtime doesn't guarantee that `res.setHeader('Set-Cookie', ...)` called inside `getServerSideProps` reaches the browser. Fetching `/api/auth/csrf` client-side goes through the auth API route handler, which sets the cookie reliably via its own Web `Response`. This is the same pattern the NextAuth v4 built-in sign-in page uses.

**Why native `<form method="POST">`?**

A native form POST is the most reliable way to include both the CSRF cookie (sent automatically by the browser) and the CSRF token (as a hidden field). It requires no JS in the submit path and handles redirects correctly.

### OAuth flow

```
Browser                         Server
  │                               │
  ├─ signIn("google") ───────────►│ redirects to Google consent page
  │◄── 302 → Google ─────────────┤
  │                               │
  ├─ (user consents) ────────────►│ Google redirects back with ?code=
  │                          GET /api/auth/callback/google
  │                          exchanges code for tokens
  │                          issues JWT session cookie
  │◄── 302 → /dashboard ─────────┤
```

### Route protection

Protection is applied at two layers:

**Layer 1 — Edge proxy (`proxy.ts`)**

```ts
export const proxy = withAuth({ pages: { signIn: "/" } });
export const config = { matcher: ["/dashboard/:path*"] };
```

`withAuth` runs before the page handler. If no valid session token is found in the request cookie, the user is immediately redirected to `/` without the page ever rendering.

**Layer 2 — `getServerSideProps` (`dashboard.tsx`)**

```ts
const { pagesAuth } = await import("@/auth");
const session = await pagesAuth(ctx.req);
if (!session) return { redirect: { destination: "/", permanent: false } };
```

A second check runs server-side. This handles edge cases where the proxy is bypassed (e.g., direct Worker invocation, stale token). Defense in depth.

**Why dynamic import instead of top-level import?**

Vinext uses Vite, which does not tree-shake `getServerSideProps` imports like Next.js/webpack does. A top-level `import { pagesAuth } from "@/auth"` would include the entire `auth.ts` module in the client bundle, where `process.env.VINEXTAUTH_SECRET` is undefined — causing a runtime error. Dynamic import inside `getServerSideProps` ensures `auth.ts` only runs on the server.

### Sign-out flow

Sign-out uses a native form POST with a CSRF token:

```tsx
<form method="POST" action="/api/auth/signout">
  <input type="hidden" name="csrfToken" value={csrfToken} />
  <input type="hidden" name="callbackUrl" value="/" />
  <button type="submit">Sign out</button>
</form>
```

The CSRF token is fetched from `/api/auth/csrf` on mount (same as the login page). The handler verifies the token, clears all session cookies, and redirects to `/`.

## Security model

| Protection | Mechanism |
|---|---|
| CSRF on login | Double-submit cookie: `csrfToken` in body verified against `vinextauth.csrf-token` cookie (HMAC-SHA256) |
| CSRF on sign-out | Same double-submit cookie pattern |
| Session forgery | JWT signed with HMAC-SHA256 using `VINEXTAUTH_SECRET` |
| Session theft via JS | Session cookie is `HttpOnly` — inaccessible to JavaScript |
| Cross-site cookie abuse | Session and CSRF cookies use `SameSite=Lax` |
| Open redirects | `sanitizeRedirectUrl` in the lib validates all redirect targets are same-origin |
| Brute force (credentials) | Built-in in-memory rate limiter (5 attempts / 15 min per IP) |
| Auth code in client bundle | Dynamic import in `getServerSideProps` keeps `auth.ts` server-only |

## Customizing for production

### Replace the demo user with a real database lookup

In `src/auth.ts`, update the `authorize` function:

```ts
Credentials({
  async authorize(credentials) {
    const user = await db.user.findUnique({
      where: { email: credentials?.email },
    });
    if (!user) return null;
    const valid = await bcrypt.compare(credentials?.password, user.passwordHash);
    return valid ? { id: user.id, name: user.name, email: user.email } : null;
  },
}),
```

### Add more protected routes

In `src/proxy.ts`, extend the matcher:

```ts
export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/admin/:path*"],
};
```

### Add role-based access control

```ts
export const proxy = withAuth(
  (req) => undefined,
  {
    callbacks: {
      authorized: ({ token }) => token?.role === "admin",
    },
  }
);
```

### Store sessions in Cloudflare KV

In `src/auth.ts`:

```ts
import { CloudflareKVAdapter } from "vinextauth/adapters/cloudflare-kv";

const config = {
  session: { strategy: "database" },
  adapter: CloudflareKVAdapter(env.SESSION_KV),
  // ...
};
```

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `VINEXTAUTH_SECRET` | Yes | Base64 secret for JWT signing. Generate: `openssl rand -base64 32` |
| `VINEXTAUTH_URL` | Yes | Canonical public URL of the app |
| `GOOGLE_CLIENT_ID` | OAuth | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | Google OAuth app client secret |
| `GITHUB_CLIENT_ID` | OAuth | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | OAuth | GitHub OAuth app client secret |

To set up Google OAuth: [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client ID. Add `http://localhost:3002/api/auth/callback/google` as an authorized redirect URI.

To set up GitHub OAuth: [github.com/settings/applications/new](https://github.com/settings/applications/new). Set callback URL to `http://localhost:3002/api/auth/callback/github`.
