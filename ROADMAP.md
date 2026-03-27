# VinextAuth — Implementation Roadmap

This document tracks the planned work to bring VinextAuth to full NextAuth v4 feature parity and beyond. Items are ordered by priority.

---

## Summary

| # | Feature | Priority | Complexity | Status |
|---|---------|----------|------------|--------|
| 1 | [OAuth Providers](#1-oauth-providers) | High | Low | ✅ Done |
| 2 | [Email / Magic Link Provider](#2-email--magic-link-provider) | High | High | ✅ Done |
| 3 | [Events System](#3-events-system) | Medium | Low | ✅ Done |
| 4 | [Distributed Rate Limiter — Cloudflare KV](#4-distributed-rate-limiter--cloudflare-kv) | Medium | Low | ✅ Done |
| 5 | [Cloudflare D1 Adapter](#5-cloudflare-d1-adapter) | Medium | Medium | ✅ Done |
| 6 | [Test Coverage Expansion](#6-test-coverage-expansion) | Medium | Medium | ⬜ Pending |

---

## 1. OAuth Providers

**Priority: High — Low complexity**

VinextAuth currently ships Google and GitHub. The pattern is established — each provider is a pure function returning an `OAuthProvider` object. Adding providers is mechanical work with no architectural changes.

### Providers to implement

| Provider | File | OAuth Version | Notes |
|----------|------|---------------|-------|
| Discord | `src/providers/discord.ts` | OAuth2 | `identify email` scope |
| Microsoft / Azure AD | `src/providers/microsoft.ts` | OAuth2 | tenant-aware, `openid email profile` |
| Apple | `src/providers/apple.ts` | OAuth2 | **complex** — requires JWT client secret signed with ES256 |
| Twitter / X | `src/providers/twitter.ts` | OAuth2 + PKCE | use `checks: ['pkce', 'state']` |
| Facebook | `src/providers/facebook.ts` | OAuth2 | Graph API userinfo |
| LinkedIn | `src/providers/linkedin.ts` | OAuth2 | |
| Twitch | `src/providers/twitch.ts` | OAuth2 | |
| Spotify | `src/providers/spotify.ts` | OAuth2 | |

### Implementation template

Every provider follows the same contract. Copy `src/providers/github.ts` and adjust endpoints + profile mapping:

```ts
// src/providers/discord.ts
import type { OAuthProvider, User } from '../types.js';

export interface DiscordProviderConfig {
  clientId: string;
  clientSecret: string;
  authorization?: { params?: Record<string, string> };
}

export function DiscordProvider(config: DiscordProviderConfig): OAuthProvider {
  return {
    id: 'discord',
    name: 'Discord',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://discord.com/api/oauth2/authorize',
      params: {
        response_type: 'code',
        scope: 'identify email',
        ...config.authorization?.params,
      },
    },
    token: { url: 'https://discord.com/api/oauth2/token' },
    userinfo: { url: 'https://discord.com/api/users/@me' },
    profile(profile): User {
      return {
        id: profile.id as string,
        name: profile.username as string | null,
        email: profile.email as string | null,
        image: profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : null,
      };
    },
    checks: ['state'],
  };
}

export default DiscordProvider;
```

### Apple — special handling

Apple requires a short-lived JWT as the `client_secret` (ES256, signed with a `.p8` private key). This is the only provider that cannot use a static secret string.

The `OAuthProvider` interface needs a `clientSecretFactory` escape hatch, or Apple can override the token exchange step with a custom `token` object:

```ts
// Proposed addition to OAuthProvider in types.ts
export interface OAuthProvider {
  // ...existing fields
  /**
   * Optional: generate client_secret dynamically per request.
   * Required for Apple (JWT client secret signed with ES256 each time).
   */
  clientSecretFactory?: () => Promise<string>;
}
```

Apple config shape:
```ts
export interface AppleProviderConfig {
  clientId: string;       // Services ID (com.yourapp.signin)
  teamId: string;         // 10-char Team ID
  keyId: string;          // Key ID from Apple Developer
  privateKey: string;     // PEM content of .p8 file
}
```

The factory would sign a JWT using Web Crypto `ECDSA` with the P-256 curve — fully edge-compatible.

### Checklist per provider

After creating the file:

1. Add named export to `src/index.ts`
2. Add entry to `tsup.config.ts` under `entry`:
   ```ts
   'providers/discord': 'src/providers/discord.ts',
   ```
3. Add export to `package.json#exports`:
   ```json
   "./providers/discord": {
     "import": "./dist/providers/discord.js",
     "types": "./dist/providers/discord.d.ts"
   }
   ```

---

## 2. Email / Magic Link Provider

**Priority: High — High complexity**

This is the most impactful gap. Many apps use passwordless email auth. The implementation requires:

1. A new `EmailProvider` type
2. A `VerificationToken` model in the adapter interface
3. A new handler: `handleEmailSignin`
4. A new handler: `handleEmailVerify` (the link-click endpoint)
5. An `EmailTransport` interface for sending emails

### New types in `types.ts`

```ts
// ─── Email Provider ───────────────────────────────────────────────────────────

export interface EmailTransport {
  /**
   * Send a sign-in email with a magic link.
   * Use any edge-compatible HTTP email API (Resend, SendGrid, Mailgun, etc.)
   */
  sendVerificationRequest(params: {
    identifier: string;   // email address
    url: string;          // the magic link URL
    expires: Date;
    provider: EmailProvider;
    request: Request;
  }): Promise<void>;
}

export interface EmailProvider {
  id: string;
  name: string;
  type: 'email';
  from?: string;
  maxAge?: number;          // token TTL in seconds, default 24h
  transport: EmailTransport;
  generateVerificationToken?: () => Promise<string>;
}

// ─── Adapter — Verification tokens ───────────────────────────────────────────

export interface VerificationToken {
  identifier: string;  // email
  token: string;
  expires: Date;
}

// Add to AdapterInterface:
export interface AdapterInterface {
  // ...existing methods
  createVerificationToken?(token: VerificationToken): Promise<VerificationToken>;
  useVerificationToken?(params: {
    identifier: string;
    token: string;
  }): Promise<VerificationToken | null>;
  getUserByEmail?(email: string): Promise<DefaultUser | null>;
  createUser?(user: Omit<DefaultUser, 'id'>): Promise<DefaultUser>;
}
```

### New handler: `src/handlers/email-signin.ts`

Flow: `POST /api/auth/signin/email`

```
1. Validate CSRF token
2. Extract email from body
3. Check adapter.getUserByEmail() — create if not exists (or fail if allowNewUsers = false)
4. Generate a secure verification token (crypto.getRandomValues)
5. Store token via adapter.createVerificationToken()
6. Build the magic link: {baseUrl}/api/auth/callback/email?token=...&email=...
7. Call provider.transport.sendVerificationRequest()
8. Redirect to /api/auth/verify-request (or provider.pages.verifyRequest)
```

### New handler: `src/handlers/email-verify.ts`

Flow: `GET /api/auth/callback/email?token=...&email=...`

```
1. Extract token + email from query params
2. Call adapter.useVerificationToken() — returns token if valid, null if expired/used
3. If null → redirect to /api/auth/error?error=Verification
4. Look up user by email via adapter.getUserByEmail()
5. Run signIn callback
6. Create session (JWT or database depending on strategy)
7. Set session cookie
8. Redirect to callbackUrl
```

### Email transport — Resend example

```ts
// src/providers/email.ts

import type { EmailProvider, EmailTransport } from '../types.js';

export function ResendTransport(options: { apiKey: string; from?: string }): EmailTransport {
  return {
    async sendVerificationRequest({ identifier, url, provider }) {
      const from = options.from ?? provider.from ?? 'noreply@example.com';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: identifier,
          subject: 'Sign in to your account',
          html: `<p>Click <a href="${url}">here</a> to sign in. This link expires in 24 hours.</p>`,
        }),
      });
      if (!res.ok) throw new Error(`[VinextAuth] Resend error: ${res.status}`);
    },
  };
}

export function EmailProvider(config: {
  from?: string;
  maxAge?: number;
  transport: EmailTransport;
}): import('../types.js').EmailProvider {
  return {
    id: 'email',
    name: 'Email',
    type: 'email',
    from: config.from,
    maxAge: config.maxAge ?? 24 * 60 * 60,
    transport: config.transport,
  };
}
```

### Changes needed across the codebase

| File | Change |
|------|--------|
| `src/types.ts` | Add `EmailProvider`, `EmailTransport`, `VerificationToken` types; extend `AdapterInterface` |
| `src/handlers/index.ts` | Add routing for `POST signin/email` and `GET callback/email` |
| `src/handlers/email-signin.ts` | New file — handles magic link generation + email dispatch |
| `src/handlers/email-verify.ts` | New file — handles link verification + session creation |
| `src/providers/email.ts` | `EmailProvider()` factory + `ResendTransport()` helper |
| `src/adapters/cloudflare-kv.ts` | Implement `createVerificationToken`, `useVerificationToken`, `getUserByEmail`, `createUser` |
| `src/pages/index.ts` | Add "Check your email" page (`renderVerifyRequestPage`) |
| `tsup.config.ts` | Add `providers/email` entry |
| `package.json` | Add `./providers/email` export |

---

## 3. Events System

**Priority: Medium — Low complexity**

NextAuth fires lifecycle events that apps use for audit logging, analytics, welcome emails, and user provisioning. VinextAuth has no events today.

### New types in `types.ts`

```ts
// ─── Events ───────────────────────────────────────────────────────────────────

export interface EventsConfig<TUser = {}> {
  /**
   * Fires when a user signs in.
   * `isNewUser` is true on first sign-in (OAuth only, requires adapter).
   */
  signIn?: (params: {
    user: User<TUser>;
    account: SignInCallbackParams['account'];
    isNewUser?: boolean;
  }) => void | Promise<void>;

  /**
   * Fires when a user signs out.
   */
  signOut?: (params: { token: DefaultJWT | null }) => void | Promise<void>;

  /**
   * Fires when a new user record is created.
   * Only called when an adapter is present and the user is created for the first time.
   */
  createUser?: (params: { user: User<TUser> }) => void | Promise<void>;

  /**
   * Fires when a user record is updated (e.g., profile refresh from OAuth).
   */
  updateUser?: (params: { user: User<TUser> }) => void | Promise<void>;

  /**
   * Fires on every session check (GET /api/auth/session).
   * Do not perform heavy work here.
   */
  session?: (params: { session: DefaultSession; token: DefaultJWT }) => void | Promise<void>;
}
```

### Add to `VinextAuthConfig`

```ts
export interface VinextAuthConfig<TSession = {}, TToken = {}, TUser = {}> {
  // ...existing fields
  events?: EventsConfig<TUser>;
}
```

### Add to `ResolvedConfig`

```ts
export interface ResolvedConfig {
  // ...existing fields
  events: EventsConfig;
}
```

### Wire into handlers

Events are fire-and-forget. They must **never** block the response.

Pattern to use in handlers:

```ts
// In callback.ts, after session is created:
void config.events.signIn?.({ user, account, isNewUser });

// In signout.ts, after cookie is cleared:
void config.events.signOut?.({ token: jwt });

// In session-route.ts, after session is read:
void config.events.session?.({ session, token: jwt });
```

### Changes needed

| File | Change |
|------|--------|
| `src/types.ts` | Add `EventsConfig` interface; add `events?` to `VinextAuthConfig` and `ResolvedConfig` |
| `src/core/config.ts` | Spread `events: config.events ?? {}` in `resolveConfig()` |
| `src/handlers/callback.ts` | Fire `signIn` and `createUser` events |
| `src/handlers/signout.ts` | Fire `signOut` event |
| `src/handlers/session-route.ts` | Fire `session` event |
| `src/handlers/credentials.ts` | Fire `signIn` event |

---

## 4. Distributed Rate Limiter — Cloudflare KV

**Priority: Medium — Low complexity**

The built-in `InMemoryRateLimiter` does not persist across Cloudflare Worker instances (each request may hit a different isolate). The `RateLimiter` interface in `types.ts` already supports custom stores — this item adds a first-party `CloudflareKVRateLimiter` implementation.

### New file: `src/adapters/cloudflare-kv-rate-limiter.ts`

```ts
import type { RateLimiter } from '../types.js';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface AttemptRecord {
  count: number;
  resetAt: number;
}

/**
 * Cloudflare KV-backed rate limiter — persists across Worker isolates.
 *
 * Usage:
 * ```ts
 * import { CloudflareKVRateLimiter } from "vinextauth/adapters/cloudflare-kv-rate-limiter"
 *
 * VinextAuth({
 *   credentials: {
 *     rateLimit: {
 *       store: CloudflareKVRateLimiter(env.RATE_LIMIT_KV),
 *     },
 *   },
 * })
 * ```
 */
export function CloudflareKVRateLimiter(
  namespace: KVNamespace,
  options: { maxAttempts?: number; windowMs?: number } = {}
): RateLimiter {
  const maxAttempts = options.maxAttempts ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;

  function key(identifier: string): string {
    return `ratelimit:${identifier}`;
  }

  return {
    async check(identifier) {
      const now = Date.now();
      const raw = await namespace.get(key(identifier));
      const record: AttemptRecord = raw ? JSON.parse(raw) : { count: 0, resetAt: now + windowMs };

      if (now > record.resetAt) {
        const fresh: AttemptRecord = { count: 1, resetAt: now + windowMs };
        const ttl = Math.ceil(windowMs / 1000);
        await namespace.put(key(identifier), JSON.stringify(fresh), { expirationTtl: ttl });
        return { allowed: true };
      }

      if (record.count >= maxAttempts) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return { allowed: false, retryAfter };
      }

      record.count++;
      const ttl = Math.ceil((record.resetAt - now) / 1000);
      await namespace.put(key(identifier), JSON.stringify(record), { expirationTtl: ttl });
      return { allowed: true };
    },

    async reset(identifier) {
      await namespace.delete(key(identifier));
    },
  };
}
```

### Changes needed

| File | Change |
|------|--------|
| `src/adapters/cloudflare-kv-rate-limiter.ts` | New file (above) |
| `tsup.config.ts` | Add `'adapters/cloudflare-kv-rate-limiter': 'src/adapters/cloudflare-kv-rate-limiter.ts'` |
| `package.json` | Add `"./adapters/cloudflare-kv-rate-limiter"` export |

No changes to `types.ts`, `config.ts`, or any handler — the `RateLimiter` interface already supports this.

---

## 5. Cloudflare D1 Adapter

**Priority: Medium — Medium complexity**

Cloudflare D1 (SQLite) is the natural database companion to Cloudflare Workers. It supports `database` session strategy and the full adapter interface including verification tokens (required for the Email provider).

### Schema

```sql
-- migrations/0001_vinextauth.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  email_verified INTEGER,   -- Unix timestamp
  image TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL  -- Unix timestamp
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires INTEGER NOT NULL, -- Unix timestamp
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  UNIQUE(provider, provider_account_id)
);
```

### New file: `src/adapters/cloudflare-d1.ts`

```ts
import type { AdapterInterface, AdapterSession, DefaultUser, VerificationToken } from '../types.js';

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

/**
 * CloudflareD1Adapter — stores users, sessions, and verification tokens in D1.
 * Supports all AdapterInterface methods including email magic links.
 *
 * Usage:
 * ```ts
 * import { CloudflareD1Adapter } from "vinextauth/adapters/cloudflare-d1"
 *
 * VinextAuth({
 *   adapter: CloudflareD1Adapter(env.DB),
 *   session: { strategy: "database" },
 * })
 * ```
 */
export function CloudflareD1Adapter(db: D1Database): AdapterInterface {
  return {
    async getSession(sessionToken) {
      const row = await db
        .prepare(
          `SELECT s.session_token, s.user_id, s.expires,
                  u.id, u.name, u.email, u.image
           FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.session_token = ?`
        )
        .bind(sessionToken)
        .first<{
          session_token: string;
          user_id: string;
          expires: number;
          id: string;
          name: string | null;
          email: string | null;
          image: string | null;
        }>();

      if (!row) return null;

      return {
        sessionToken: row.session_token,
        userId: row.user_id,
        expires: new Date(row.expires * 1000),
        user: { id: row.id, name: row.name, email: row.email, image: row.image },
      };
    },

    async createSession(session) {
      const expires = Math.floor(session.expires.getTime() / 1000);
      await db
        .prepare(`INSERT INTO sessions (session_token, user_id, expires) VALUES (?, ?, ?)`)
        .bind(session.sessionToken, session.userId, expires)
        .run();
      return session;
    },

    async updateSession(session) {
      const expires = session.expires ? Math.floor(session.expires.getTime() / 1000) : null;
      if (expires !== null) {
        await db
          .prepare(`UPDATE sessions SET expires = ? WHERE session_token = ?`)
          .bind(expires, session.sessionToken)
          .run();
      }
      return { sessionToken: session.sessionToken, userId: '', expires: session.expires! };
    },

    async deleteSession(sessionToken) {
      await db
        .prepare(`DELETE FROM sessions WHERE session_token = ?`)
        .bind(sessionToken)
        .run();
    },

    async getUserByEmail(email) {
      const row = await db
        .prepare(`SELECT id, name, email, image FROM users WHERE email = ?`)
        .bind(email)
        .first<DefaultUser>();
      return row ?? null;
    },

    async createUser(user) {
      const id = generateId();
      await db
        .prepare(`INSERT INTO users (id, name, email, image) VALUES (?, ?, ?, ?)`)
        .bind(id, user.name ?? null, user.email ?? null, user.image ?? null)
        .run();
      return { ...user, id };
    },

    async linkAccount(userId, provider, providerAccountId) {
      const id = generateId();
      await db
        .prepare(
          `INSERT OR IGNORE INTO accounts (id, user_id, provider, provider_account_id) VALUES (?, ?, ?, ?)`
        )
        .bind(id, userId, provider, providerAccountId)
        .run();
    },

    async getAccountByProvider(provider, providerAccountId) {
      const row = await db
        .prepare(
          `SELECT user_id FROM accounts WHERE provider = ? AND provider_account_id = ?`
        )
        .bind(provider, providerAccountId)
        .first<{ user_id: string }>();
      return row ? { userId: row.user_id } : null;
    },

    async createVerificationToken(verificationToken) {
      const expires = Math.floor(verificationToken.expires.getTime() / 1000);
      await db
        .prepare(
          `INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)`
        )
        .bind(verificationToken.identifier, verificationToken.token, expires)
        .run();
      return verificationToken;
    },

    async useVerificationToken({ identifier, token }) {
      const row = await db
        .prepare(
          `SELECT identifier, token, expires FROM verification_tokens WHERE identifier = ? AND token = ?`
        )
        .bind(identifier, token)
        .first<{ identifier: string; token: string; expires: number }>();

      if (!row) return null;

      await db
        .prepare(`DELETE FROM verification_tokens WHERE identifier = ? AND token = ?`)
        .bind(identifier, token)
        .run();

      return {
        identifier: row.identifier,
        token: row.token,
        expires: new Date(row.expires * 1000),
      };
    },
  };
}

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Changes needed

| File | Change |
|------|--------|
| `src/adapters/cloudflare-d1.ts` | New file (above) |
| `src/types.ts` | Add `createUser`, `createVerificationToken`, `useVerificationToken` to `AdapterInterface` |
| `tsup.config.ts` | Add `'adapters/cloudflare-d1': 'src/adapters/cloudflare-d1.ts'` |
| `package.json` | Add `"./adapters/cloudflare-d1"` export |

---

## 6. Test Coverage Expansion

**Priority: Medium — Medium complexity**

The current test suite covers only the Pages Router handler bridge (`src/handlers/__tests__/pages-router.test.ts`). Critical paths are untested.

### Missing test files

```
src/
├── jwt/__tests__/
│   └── jwt.test.ts              # encode/decode, expiry, tamper detection
├── core/__tests__/
│   ├── csrf.test.ts             # token generation, verification, timing attack
│   ├── rate-limiter.test.ts     # window reset, max attempts, IP extraction
│   ├── session.test.ts          # buildJWT, buildSession, refreshTokenIfNeeded
│   └── config.test.ts           # resolveConfig defaults and overrides
├── providers/__tests__/
│   └── oauth-flow.test.ts       # state validation, profile mapping, error cases
├── handlers/__tests__/
│   ├── callback.test.ts         # OAuth callback, invalid state, missing code
│   ├── credentials.test.ts      # valid login, wrong password, rate limit hit
│   ├── signout.test.ts          # cookie cleared, redirect
│   └── session-route.test.ts   # valid token, expired token, no token
├── middleware/__tests__/
│   └── with-auth.test.ts        # authorized, unauthorized, custom callback
└── adapters/__tests__/
    └── cloudflare-kv.test.ts    # getSession, createSession, expired session
```

### Snapshot of what each suite should cover

**`jwt.test.ts`**
```ts
it('roundtrips a token through sign → verify')
it('returns null for an expired token')
it('returns null when signature is tampered')
it('rejects a token signed with a different secret')
```

**`csrf.test.ts`**
```ts
it('generateCsrfToken returns token + cookieValue with HMAC')
it('verifyCsrfToken accepts a valid cookie + token pair')
it('verifyCsrfToken rejects mismatched token')
it('verifyCsrfToken rejects tampered HMAC')
```

**`rate-limiter.test.ts`**
```ts
it('allows up to maxAttempts within window')
it('blocks on maxAttempts + 1 and returns retryAfter')
it('resets after window expires')
it('reset() clears the counter')
it('getClientIp() prefers cf-connecting-ip over x-forwarded-for')
```

**`callback.test.ts`**
```ts
it('exchanges code for token and creates session cookie')
it('redirects to error page when state is missing')
it('redirects to error page when state is invalid')
it('redirects to error page when token exchange fails')
it('runs signIn callback and blocks sign-in when it returns false')
```

**`credentials.test.ts`**
```ts
it('signs in with valid credentials and sets session cookie')
it('returns 401 when authorize() returns null')
it('returns 429 when rate limit is exceeded')
it('rejects missing CSRF token')
it('rejects invalid CSRF token')
```

**`with-auth.test.ts`**
```ts
it('passes through requests with a valid session token')
it('redirects to sign-in page when token is missing')
it('redirects to sign-in page when token is expired')
it('calls authorized() callback and respects its return value')
it('passes through to inner middleware when authorized')
```

### Vitest config note

Tests already use `vitest` globals. For Web Crypto in tests, ensure `vitest.config.ts` has:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',   // Web Crypto available in Node 18+
    globals: true,
  },
});
```

---

## Completed

_(Items move here once merged)_

- ✅ JWT-first sessions with HMAC-SHA256 (Web Crypto)
- ✅ OAuth2 flow — Google, GitHub
- ✅ Credentials provider with built-in rate limiting
- ✅ CSRF protection (double-submit cookie)
- ✅ Token refresh race condition fix (mutex lock)
- ✅ `updateSession()` server-side
- ✅ Multi-tenant `baseUrl` as async function
- ✅ Cloudflare KV session adapter
- ✅ React `<SessionProvider>`, `useSession`, `signIn`, `signOut`
- ✅ `getServerSession()` / `auth()` / `pagesAuth()`
- ✅ `withAuth()` edge middleware
- ✅ Pages Router bridge (`toPages()`)
- ✅ Built-in sign-in + error pages
- ✅ Generic types without module augmentation
- ✅ **OAuth Providers** — Discord, Facebook, LinkedIn, Twitch, Spotify, Microsoft/Azure AD, Twitter/X (OAuth2 + PKCE), Apple (ES256 JWT client secret via Web Crypto)
- ✅ **Email / Magic Link Provider** — `EmailProvider` + `ResendTransport`, `handleEmailSignin`, `handleEmailVerify`, verify-request page, `CloudflareKVAdapter` extended with user + verification token methods
- ✅ **Events System** — `EventsConfig` with `signIn`, `signOut`, `createUser`, `updateUser`, `session` hooks; fire-and-forget wired into all handlers
- ✅ **Distributed Rate Limiter — Cloudflare KV** — `CloudflareKVRateLimiter` adapter; persists across Worker isolates
- ✅ **Cloudflare D1 Adapter** — `CloudflareD1Adapter`; full `AdapterInterface` + SQL migration at `migrations/0001_vinextauth.sql`
