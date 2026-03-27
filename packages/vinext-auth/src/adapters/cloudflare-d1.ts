import type { AdapterInterface, DefaultUser } from '../types.js';

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
 *
 * Run the migration before first use:
 * ```sql
 * -- migrations/0001_vinextauth.sql
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
      await db.prepare(`DELETE FROM sessions WHERE session_token = ?`).bind(sessionToken).run();
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
        .prepare(`SELECT user_id FROM accounts WHERE provider = ? AND provider_account_id = ?`)
        .bind(provider, providerAccountId)
        .first<{ user_id: string }>();
      return row ? { userId: row.user_id } : null;
    },

    async createVerificationToken(verificationToken) {
      const expires = Math.floor(verificationToken.expires.getTime() / 1000);
      await db
        .prepare(`INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)`)
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
