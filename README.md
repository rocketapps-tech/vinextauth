# VinextAuth

Drop-in NextAuth v4 replacement for Next.js + Cloudflare Workers. Zero Node.js dependencies — pure Web Crypto API.

## Features

- **Edge-ready** — runs on Cloudflare Workers, Vercel Edge, and any Web Crypto environment
- **Zero dependencies** — no `jose`, no `cookie`, no Node.js built-ins
- **Generic types** — type your session without module augmentation
- **Auth.js v5 style** — `auth()` pre-bound on the handlers object
- **Multi-tenant** — dynamic `baseUrl` per request
- **Database sessions** — full adapter lifecycle (create, read, delete)
- **Credentials** — built-in rate limiting (5 attempts / 15 min, pluggable store)
- **Account linking** — safe explicit API (replaces `allowDangerousEmailAccountLinking`)
- **Server-side update** — `updateSession()` from Server Actions and Route Handlers
- **Token refresh** — race-condition-safe automatic rotation

---

## Installation

```bash
npm install vinextauth
```

---

## Quick start

```ts
// app/api/auth/[...nextauth]/route.ts
import { VinextAuth } from "vinextauth"
import { GoogleProvider } from "vinextauth/providers/google"

export const { GET, POST, auth } = VinextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
})
```

```ts
// app/dashboard/page.tsx (Server Component)
import { auth } from "@/app/api/auth/[...nextauth]/route"

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

  // Secret — or set NEXTAUTH_SECRET / VINEXTAUTH_SECRET env var
  secret: process.env.AUTH_SECRET,

  // Dynamic base URL for multi-tenant apps
  baseUrl: (req) => `https://${req.headers.get("host")}`,

  session: {
    strategy: "jwt",      // "jwt" | "database"
    maxAge: 30 * 24 * 3600, // 30 days
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
})
```

---

## Providers

### Google

```ts
import { GoogleProvider } from "vinextauth/providers/google"

GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
})
```

### GitHub

```ts
import { GitHubProvider } from "vinextauth/providers/github"

GitHubProvider({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
})
```

### Credentials

```ts
import { CredentialsProvider } from "vinextauth/providers/credentials"

CredentialsProvider({
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
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
      // store: myRedisRateLimiter, // custom store
    },
  },
})
```

---

## Custom types — no module augmentation

```ts
// auth.ts
export const { GET, POST, auth } = VinextAuth<
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

// server component
const session = await auth<{ role: "admin" | "user" }>()
session?.user.role // "admin" | "user" ✓
```

---

## Server helpers

### `auth()` — pre-bound (preferred)

```ts
// auth.ts
export const { GET, POST, auth } = VinextAuth({ ... })

// anywhere on the server
import { auth } from "@/auth"
const session = await auth()
```

### `getServerSession()` — explicit config

```ts
import { getServerSession } from "vinextauth/server"
import { authOptions } from "@/auth"

const session = await getServerSession(authOptions)
```

### `updateSession()` — server-side session update

NextAuth v4 had no server-side session update. VinextAuth adds it:

```ts
import { updateSession } from "vinextauth/server"
import { authOptions } from "@/auth"

// In a Server Action
await updateSession(authOptions, { user: { role: "admin" } })
```

### `invalidateSession()` — revoke server-side

```ts
import { invalidateSession } from "vinextauth/server"

await invalidateSession(authOptions)
```

---

## React hooks

```tsx
// app/layout.tsx
import { SessionProvider } from "vinextauth/react"

export default function Layout({ children }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

```tsx
// any client component
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

## Middleware

Drop-in for NextAuth v4's `withAuth`:

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

## Database sessions (Cloudflare KV)

```ts
import { CloudflareKVAdapter } from "vinextauth/adapters/cloudflare-kv"

export const { GET, POST, auth } = VinextAuth({
  providers: [...],
  adapter: CloudflareKVAdapter(env.SESSION_KV),
  session: { strategy: "database" },
})
```

When `strategy: "database"`:
- Sign-in stores an opaque session token in the cookie (not a JWT)
- Each request looks up the session in the adapter
- Sign-out deletes the session, enabling true server-side revocation

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

Unlike NextAuth's `allowDangerousEmailAccountLinking`, this requires the adapter to confirm email ownership before linking.

---

## Custom rate limiter (Redis, KV, etc.)

Implement the `RateLimiter` interface:

```ts
import type { RateLimiter } from "vinextauth"

const myLimiter: RateLimiter = {
  async check(key) {
    // return { allowed: true } or { allowed: false, retryAfter: 60 }
  },
  async reset(key) { ... },
}

VinextAuth({
  credentials: {
    rateLimit: { store: myLimiter },
  },
})
```

---

## Environment variables

| Variable | Description |
|---|---|
| `NEXTAUTH_SECRET` / `VINEXTAUTH_SECRET` | Signing secret (required) |
| `NEXTAUTH_URL` / `VINEXTAUTH_URL` | Base URL (optional, auto-detected) |
| `VERCEL_URL` | Auto-detected on Vercel |

---

## Differences from NextAuth v4

| | NextAuth v4 | VinextAuth |
|---|---|---|
| Edge runtime | Partial | Full (Web Crypto only) |
| Custom types | Module augmentation | Generics `VinextAuth<{role: string}>()` |
| `auth()` helper | No | Yes — pre-bound on handlers |
| Server-side session update | No | `updateSession()` |
| Dynamic base URL | No | `baseUrl: (req) => string` |
| Account linking | `allowDangerousEmailAccountLinking` | Safe explicit API |
| Credentials rate limiting | Manual | Built-in |
| Node.js dependencies | Yes | None |

---

## License

MIT
