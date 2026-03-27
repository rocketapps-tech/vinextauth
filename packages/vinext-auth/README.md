# VinextAuth

Drop-in NextAuth v4 replacement for **[Vinext](https://vinext.io/) + Cloudflare Workers**. Zero Node.js dependencies — pure Web Crypto API.

[![npm version](https://img.shields.io/npm/v/vinextauth?label=latest%20stable&color=0070f3)](https://www.npmjs.com/package/vinextauth)
[![npm downloads](https://img.shields.io/npm/dm/vinextauth?label=downloads&color=brightgreen)](https://www.npmjs.com/package/vinextauth)
[![stars](https://img.shields.io/github/stars/rocketapps/vinextauth?label=stars&color=orange)](https://github.com/rocketapps/vinextauth)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## Features

- **Edge-ready** — runs on Cloudflare Workers, Vinext edge runtime, and any Web Crypto environment
- **Zero dependencies** — no `jose`, no `cookie`, no Node.js built-ins
- **Pages Router + App Router** — native support for both via `toPages()` and `auth()`
- **Generic types** — type your session without module augmentation
- **Multi-tenant** — dynamic `baseUrl` per request
- **10 OAuth providers** — Google, GitHub, Discord, Facebook, LinkedIn, Twitch, Spotify, Microsoft/Azure AD, Twitter/X (PKCE), Apple (ES256 JWT secret)
- **Email / Magic Link** — passwordless auth via `EmailProvider` + `ResendTransport`
- **Database sessions** — full adapter lifecycle (create, read, delete); KV and D1 adapters included
- **Credentials** — built-in rate limiting (5 attempts / 15 min, pluggable store)
- **Distributed rate limiter** — `CloudflareKVRateLimiter` persists across Worker isolates
- **Events system** — `signIn`, `signOut`, `createUser`, `updateUser`, `session` lifecycle hooks
- **Account linking** — safe explicit API; new users auto-created and linked on first OAuth sign-in
- **Server-side update** — `updateSession()` from Server Actions
- **Token refresh** — race-condition-safe automatic rotation

---

## Installation

```bash
npm install vinextauth
```

---

## Quick start

### Pages Router (recommended for Vinext)

**1. Configure auth**

```ts
// src/auth.ts
import VinextAuth from "vinextauth"
import Google from "vinextauth/providers/google"

export const { GET, POST, auth, toPages, pagesAuth } = VinextAuth({
  secret: process.env.VINEXTAUTH_SECRET!,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
})
```

**2. Create the catch-all API route**

```ts
// src/pages/api/auth/[...vinextauth].ts
import { toPages } from "@/auth"

export default toPages()
```

**3. Wrap your app with SessionProvider**

```tsx
// src/pages/_app.tsx
import type { AppProps } from "vinext/app"
import { SessionProvider } from "vinextauth/react"

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <Component {...pageProps} />
    </SessionProvider>
  )
}
```

**4. Protect a page server-side**

```ts
// src/pages/dashboard.tsx
import type { GetServerSideProps } from "vinext"
import { pagesAuth } from "@/auth"

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await pagesAuth(ctx.req)
  if (!session) return { redirect: { destination: "/api/auth/signin", permanent: false } }
  return { props: { session } }
}
```

---

### App Router

```ts
// src/app/api/auth/[...vinextauth]/route.ts
import { GET, POST } from "@/auth"
export { GET, POST }
```

```ts
// src/app/dashboard/page.tsx (Server Component)
import { auth } from "@/auth"
import { redirect } from "vinext/navigation"

export default async function Dashboard() {
  const session = await auth()
  if (!session) redirect("/api/auth/signin")
  return <h1>Hello, {session.user.name}</h1>
}
```

---

## Configuration

```ts
VinextAuth({
  providers: [...],

  // Secret — or set VINEXTAUTH_SECRET env var
  secret: process.env.VINEXTAUTH_SECRET,

  // Dynamic base URL for multi-tenant apps
  baseUrl: (req) => `https://${req.headers.get("host")}`,

  session: {
    strategy: "jwt",          // "jwt" | "database"
    maxAge: 30 * 24 * 3600,   // 30 days
    updateAge: 24 * 3600,
  },

  theme: {
    brandName: "My App",
    logoUrl: "/logo.png",
    buttonColor: "#6366f1",
  },

  pages: {
    signIn: "/login",
    error: "/auth/error",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role
      return token
    },
    async session({ session, token }) {
      session.user.role = token.role
      return session
    },
  },

  events: {
    async signIn({ user, isNewUser }) {
      if (isNewUser) await sendWelcomeEmail(user.email)
    },
    async signOut({ token }) {
      console.log("signed out:", token?.sub)
    },
  },
})
```

---

## Providers

### OAuth providers

```ts
import Google    from "vinextauth/providers/google"
import GitHub    from "vinextauth/providers/github"
import Discord   from "vinextauth/providers/discord"
import Facebook  from "vinextauth/providers/facebook"
import LinkedIn  from "vinextauth/providers/linkedin"
import Twitch    from "vinextauth/providers/twitch"
import Spotify   from "vinextauth/providers/spotify"
import Microsoft from "vinextauth/providers/microsoft"
import Twitter   from "vinextauth/providers/twitter"   // OAuth2 + PKCE
import Apple     from "vinextauth/providers/apple"     // ES256 JWT client secret
```

All providers share the same config shape:

```ts
Google({ clientId: "...", clientSecret: "..." })
```

Apple requires a JWT secret instead of a static string:

```ts
Apple({
  clientId: "com.yourapp.signin",
  teamId: "TEAM123456",
  keyId: "KEY123456",
  privateKey: process.env.APPLE_PRIVATE_KEY!, // PEM content of .p8 file
})
```

### Email / Magic Link

Passwordless authentication via a one-time link sent by email.

```ts
import { EmailProvider, ResendTransport } from "vinextauth/providers/email"
import { CloudflareKVAdapter } from "vinextauth/adapters/cloudflare-kv"

VinextAuth({
  providers: [
    EmailProvider({
      from: "no-reply@yourapp.com",
      transport: ResendTransport({ apiKey: env.RESEND_API_KEY }),
    }),
  ],
  // Adapter required for verification token storage
  adapter: CloudflareKVAdapter(env.SESSION_KV),
})
```

Bring your own transport by implementing `EmailTransport`:

```ts
import type { EmailTransport } from "vinextauth"

const myTransport: EmailTransport = {
  async sendVerificationRequest({ identifier, url }) {
    await myEmailAPI.send({ to: identifier, magicLink: url })
  },
}
```

### Credentials

```ts
import Credentials from "vinextauth/providers/credentials"

Credentials({
  async authorize({ email, password }) {
    const user = await db.user.findByEmail(email)
    if (!user || !verifyPassword(password, user.passwordHash)) return null
    return { id: user.id, email: user.email, name: user.name }
  },
})
```

Rate limiting is built-in (5 attempts / 15 min per IP). Configure or replace:

```ts
VinextAuth({
  credentials: {
    rateLimit: {
      maxAttempts: 10,
      windowMs: 10 * 60 * 1000,
      store: myRateLimiter, // optional — see CloudflareKVRateLimiter below
    },
  },
})
```

---

## Events

Fire-and-forget lifecycle hooks. Never block the response.

```ts
VinextAuth({
  events: {
    async signIn({ user, account, isNewUser }) {
      if (isNewUser) await sendWelcomeEmail(user.email)
    },
    async signOut({ token }) { /* audit log */ },
    async createUser({ user }) { /* provision resources */ },
    async updateUser({ user }) { /* sync profile */ },
    async session({ session, token }) { /* track active sessions */ },
  },
})
```

---

## Database sessions

### Cloudflare KV adapter

```ts
import { CloudflareKVAdapter } from "vinextauth/adapters/cloudflare-kv"

VinextAuth({
  providers: [...],
  adapter: CloudflareKVAdapter(env.SESSION_KV),
  session: { strategy: "database" },
})
```

### Cloudflare D1 adapter

Full SQLite-backed sessions — supports the `database` strategy and email magic links.

```ts
import { CloudflareD1Adapter } from "vinextauth/adapters/cloudflare-d1"

VinextAuth({
  providers: [...],
  adapter: CloudflareD1Adapter(env.DB),
  session: { strategy: "database" },
})
```

Run the bundled migration before first use:

```bash
wrangler d1 execute <DB_NAME> --file=node_modules/vinextauth/migrations/0001_vinextauth.sql
```

### Custom adapter

```ts
import type { AdapterInterface } from "vinextauth"

const myAdapter: AdapterInterface = {
  async getSession(sessionToken) { ... },
  async createSession(session) { ... },
  async updateSession(session) { ... },
  async deleteSession(sessionToken) { ... },
}
```

When `strategy: "database"`:
- Sign-in stores an opaque session token in the cookie (not a JWT)
- Each request looks up the session in the adapter
- Sign-out deletes the session, enabling true server-side revocation

---

## Distributed rate limiter (Cloudflare KV)

The default `InMemoryRateLimiter` resets on each Worker isolate restart. Use `CloudflareKVRateLimiter` to share state across all instances:

```ts
import { CloudflareKVRateLimiter } from "vinextauth/adapters/cloudflare-kv-rate-limiter"

VinextAuth({
  credentials: {
    rateLimit: {
      store: CloudflareKVRateLimiter(env.RATE_LIMIT_KV, {
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,
      }),
    },
  },
})
```

---

## Pages Router helpers

### `toPages()` — catch-all API route handler

Returns a `(req, res)` handler compatible with Vinext / Next.js Pages Router.

```ts
// pages/api/auth/[...vinextauth].ts
import { toPages } from "@/auth"
export default toPages()
```

### `pagesAuth(req)` — server-side session

Reads the session from request cookies inside `getServerSideProps`. Works without `next/headers`.

```ts
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await pagesAuth(ctx.req)
  if (!session) return { redirect: { destination: "/api/auth/signin", permanent: false } }
  return { props: { session } }
}
```

---

## Custom types — no module augmentation

```ts
// auth.ts
export const { GET, POST, auth, toPages, pagesAuth } = VinextAuth<
  { role: "admin" | "user" },  // session.user extras
  { role: string }              // JWT token extras
>({
  providers: [...],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as any).role
      return token
    },
    session({ session, token }) {
      session.user.role = token.role  // fully typed ✓
      return session
    },
  },
})

// server component or getServerSideProps
const session = await auth<{ role: "admin" | "user" }>()
session?.user.role // "admin" | "user" ✓
```

---

## React hooks

```tsx
"use client"
import { useSession, signIn, signOut } from "vinextauth/react"

export function UserMenu() {
  const { data: session, status } = useSession()

  if (status === "loading") return <Spinner />
  if (!session) return <button onClick={() => signIn("google")}>Sign in</button>

  return (
    <>
      <span>{session.user.name}</span>
      <button onClick={() => signOut()}>Sign out</button>
    </>
  )
}
```

---

## Server helpers

### `auth()` — App Router / Server Components

```ts
import { auth } from "@/auth"
const session = await auth()
```

### `getServerSession()` — explicit config

```ts
import { getServerSession } from "vinextauth/server"
import { authOptions } from "@/auth"

const session = await getServerSession(authOptions)
```

### `updateSession()` — update session data server-side

```ts
import { updateSession } from "vinextauth/server"
await updateSession(authOptions, { user: { role: "admin" } })
```

### `invalidateSession()` — revoke server-side

```ts
import { invalidateSession } from "vinextauth/server"
await invalidateSession(authOptions)
```

---

## Middleware

```ts
// middleware.ts
import { withAuth } from "vinextauth/middleware"

export default withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ token }) {
      return token?.role === "admin"
    },
  },
})

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
}
```

---

## Account linking

```ts
VinextAuth({
  accountLinking: {
    enabled: true,
    requireVerification: true, // default — safe mode
  },
})
```

On first OAuth sign-in the user record and account link are created automatically. On subsequent sign-ins the existing record is resolved via the account link, so `session.user.id` is always the adapter's stable UUID.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VINEXTAUTH_SECRET` | Yes | Signing secret for JWTs. Generate: `openssl rand -base64 32` |
| `VINEXTAUTH_URL` | No | Base URL of the app. Auto-detected on Vercel. |
| `VERCEL_URL` | No | Auto-detected on Vercel deployments |

---

## Differences from NextAuth v4

| | NextAuth v4 | VinextAuth |
|---|---|---|
| Target runtime | Node.js | Vinext / Cloudflare Workers (edge) |
| Edge runtime | Partial | Full (Web Crypto only) |
| Custom types | Module augmentation | Generics `VinextAuth<{role: string}>()` |
| `auth()` helper | No | Yes — pre-bound on handlers |
| Pages Router handler | Manual | `toPages()` — one line |
| Pages Router session | `getServerSideProps` + `getSession` | `pagesAuth(req)` — reads cookies directly |
| Server-side session update | No | `updateSession()` |
| Dynamic base URL | No | `baseUrl: (req) => string` |
| Account linking | `allowDangerousEmailAccountLinking` | Safe explicit API + auto user creation |
| Credentials rate limiting | Manual | Built-in + distributed KV store |
| Events | Yes | Yes |
| Email / Magic Link | Yes | Yes |
| Node.js dependencies | Yes | None |

---

## Repository structure

```
vinextauth/                     ← monorepo root (private)
├── packages/
│   └── vinext-auth/            ← published npm package (vinextauth)
│       ├── src/
│       │   ├── handlers/       ← HTTP request handlers + Pages Router adapter
│       │   ├── core/           ← session, JWT, CSRF, rate limiting
│       │   ├── providers/      ← Google, GitHub, Discord, Facebook, LinkedIn,
│       │   │                      Twitch, Spotify, Microsoft, Twitter/X, Apple,
│       │   │                      Email (magic link), Credentials
│       │   ├── react/          ← SessionProvider, useSession, signIn, signOut
│       │   ├── server/         ← getServerSession, updateSession
│       │   ├── middleware/     ← withAuth edge middleware
│       │   └── adapters/       ← CloudflareKVAdapter, CloudflareD1Adapter,
│       │                          CloudflareKVRateLimiter
│       ├── migrations/         ← SQL schema for CloudflareD1Adapter
│       └── package.json
├── apps/
│   ├── dev/vinext/             ← dev sandbox (port 3001, all providers)
│   └── examples/
│       └── vinext-basic/       ← basic example (port 3002, Google + GitHub)
└── package.json                ← workspace root
```

### Running locally

```bash
# install all workspace dependencies
npm install

# build the library
npm run build

# run the dev sandbox
cp apps/dev/vinext/.env.example apps/dev/vinext/.env.local
# fill in VINEXTAUTH_SECRET in .env.local
npm run dev:vinext        # http://localhost:3001

# run the basic example
cp apps/examples/vinext-basic/.env.example apps/examples/vinext-basic/.env.local
npm run dev:example-vinext  # http://localhost:3002

# run tests
npm run test

# watch mode (library + dev app simultaneously)
# terminal 1:
npm run dev
# terminal 2:
npm run dev:vinext
```

---

## License

MIT
