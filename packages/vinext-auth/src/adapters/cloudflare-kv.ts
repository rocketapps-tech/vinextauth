import type { AdapterInterface, DefaultUser } from '../types.js';

// Minimal KVNamespace interface (matches Cloudflare Workers types)
interface KVNamespace {
  get(key: string, options: { type: 'json' }): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

interface StoredSession {
  sessionToken: string;
  userId: string;
  expires: string;
  user: DefaultUser;
}

interface StoredUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface StoredVerificationToken {
  identifier: string;
  token: string;
  expires: string;
}

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * CloudflareKVAdapter — stores sessions, users, and verification tokens in Cloudflare KV.
 *
 * Key namespaces:
 * - `session:<token>`         — session data
 * - `user:<id>`               — user record
 * - `user_email:<email>`      — maps email → userId (for getUserByEmail)
 * - `vtoken:<identifier>:<token>` — verification token (email magic links)
 *
 * Usage:
 * ```ts
 * import { CloudflareKVAdapter } from "vinextauth/adapters/cloudflare-kv"
 *
 * VinextAuth({
 *   adapter: CloudflareKVAdapter(env.SESSION_KV),
 *   session: { strategy: "database" },
 * })
 * ```
 */
export function CloudflareKVAdapter(namespace: KVNamespace): AdapterInterface {
  // ── Key helpers ────────────────────────────────────────────────────────────

  function sessionKey(token: string): string {
    return `session:${token}`;
  }

  function userKey(id: string): string {
    return `user:${id}`;
  }

  function userEmailKey(email: string): string {
    return `user_email:${email.toLowerCase()}`;
  }

  function vtokenKey(identifier: string, token: string): string {
    return `vtoken:${identifier.toLowerCase()}:${token}`;
  }

  return {
    // ── Session methods ──────────────────────────────────────────────────────

    async getSession(sessionToken) {
      const data = (await namespace.get(sessionKey(sessionToken), {
        type: 'json',
      })) as StoredSession | null;
      if (!data) return null;
      return {
        ...data,
        expires: new Date(data.expires),
      };
    },

    async createSession(session) {
      // Look up the full user record so getSession() returns complete data
      const storedUser = (await namespace.get(userKey(session.userId), {
        type: 'json',
      })) as StoredUser | null;
      const stored: StoredSession = {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires.toISOString(),
        user: storedUser
          ? {
              id: storedUser.id,
              name: storedUser.name ?? null,
              email: storedUser.email ?? null,
              image: storedUser.image ?? null,
            }
          : { id: session.userId },
      };
      const ttl = Math.floor((session.expires.getTime() - Date.now()) / 1000);
      await namespace.put(sessionKey(session.sessionToken), JSON.stringify(stored), {
        expirationTtl: Math.max(ttl, 1),
      });
      return session;
    },

    async updateSession(session) {
      const existing = (await namespace.get(sessionKey(session.sessionToken), {
        type: 'json',
      })) as StoredSession | null;
      if (!existing) return null;
      const updated: StoredSession = {
        ...existing,
        ...session,
        expires: session.expires?.toISOString() ?? existing.expires,
      };
      await namespace.put(sessionKey(session.sessionToken), JSON.stringify(updated));
      return {
        sessionToken: session.sessionToken,
        userId: updated.userId,
        expires: new Date(updated.expires),
      };
    },

    async deleteSession(sessionToken) {
      await namespace.delete(sessionKey(sessionToken));
    },

    // ── User methods ─────────────────────────────────────────────────────────

    async getUserByEmail(email) {
      const emailIdx = (await namespace.get(userEmailKey(email), {
        type: 'json',
      })) as { userId: string } | null;
      if (!emailIdx) return null;

      const user = (await namespace.get(userKey(emailIdx.userId), {
        type: 'json',
      })) as StoredUser | null;
      return user
        ? {
            id: user.id,
            name: user.name ?? null,
            email: user.email ?? null,
            image: user.image ?? null,
          }
        : null;
    },

    async createUser(user) {
      const id = generateId();
      const stored: StoredUser = { id, ...user };
      await namespace.put(userKey(id), JSON.stringify(stored));
      if (user.email) {
        await namespace.put(userEmailKey(user.email), JSON.stringify({ userId: id }));
      }
      return { id, name: user.name ?? null, email: user.email ?? null, image: user.image ?? null };
    },

    async linkAccount(userId, provider, providerAccountId) {
      // KV doesn't have relations — store a lookup key for getAccountByProvider
      const key = `account:${provider}:${providerAccountId}`;
      await namespace.put(key, JSON.stringify({ userId }));
    },

    async getAccountByProvider(provider, providerAccountId) {
      const key = `account:${provider}:${providerAccountId}`;
      const data = (await namespace.get(key, { type: 'json' })) as { userId: string } | null;
      return data ? { userId: data.userId } : null;
    },

    // ── Verification token methods (email magic links) ────────────────────────

    async createVerificationToken(verificationToken) {
      const maxAge = Math.max(
        Math.floor((verificationToken.expires.getTime() - Date.now()) / 1000),
        1
      );
      const stored: StoredVerificationToken = {
        identifier: verificationToken.identifier,
        token: verificationToken.token,
        expires: verificationToken.expires.toISOString(),
      };
      await namespace.put(
        vtokenKey(verificationToken.identifier, verificationToken.token),
        JSON.stringify(stored),
        { expirationTtl: maxAge }
      );
      return verificationToken;
    },

    async useVerificationToken({ identifier, token }) {
      const key = vtokenKey(identifier, token);
      const data = (await namespace.get(key, { type: 'json' })) as StoredVerificationToken | null;
      if (!data) return null;

      // Delete immediately — one-time use
      await namespace.delete(key);

      return {
        identifier: data.identifier,
        token: data.token,
        expires: new Date(data.expires),
      };
    },
  };
}
