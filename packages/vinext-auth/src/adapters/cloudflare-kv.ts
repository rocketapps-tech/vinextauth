import type { AdapterInterface, User } from '../types.js';

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
  user: User;
}

/**
 * CloudflareKVAdapter — stores sessions in Cloudflare KV.
 * Use when session.strategy = "database".
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
  function key(sessionToken: string): string {
    return `session:${sessionToken}`;
  }

  return {
    async getSession(sessionToken) {
      const data = (await namespace.get(key(sessionToken), {
        type: 'json',
      })) as StoredSession | null;
      if (!data) return null;
      return {
        ...data,
        expires: new Date(data.expires),
      };
    },

    async createSession(session) {
      const stored: StoredSession = {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires.toISOString(),
        user: { id: session.userId },
      };
      const ttl = Math.floor((session.expires.getTime() - Date.now()) / 1000);
      await namespace.put(key(session.sessionToken), JSON.stringify(stored), {
        expirationTtl: Math.max(ttl, 1),
      });
      return session;
    },

    async updateSession(session) {
      const existing = (await namespace.get(key(session.sessionToken), {
        type: 'json',
      })) as StoredSession | null;
      if (!existing) return null;
      const updated: StoredSession = {
        ...existing,
        ...session,
        expires: session.expires?.toISOString() ?? existing.expires,
      };
      await namespace.put(key(session.sessionToken), JSON.stringify(updated));
      return {
        sessionToken: session.sessionToken,
        userId: updated.userId,
        expires: new Date(updated.expires),
      };
    },

    async deleteSession(sessionToken) {
      await namespace.delete(key(sessionToken));
    },
  };
}
