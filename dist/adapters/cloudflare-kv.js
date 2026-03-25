// src/adapters/cloudflare-kv.ts
function CloudflareKVAdapter(namespace) {
  function key(sessionToken) {
    return `session:${sessionToken}`;
  }
  return {
    async getSession(sessionToken) {
      const data = await namespace.get(key(sessionToken), { type: "json" });
      if (!data) return null;
      return {
        ...data,
        expires: new Date(data.expires)
      };
    },
    async createSession(session) {
      const stored = {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires.toISOString(),
        user: { id: session.userId }
      };
      const ttl = Math.floor((session.expires.getTime() - Date.now()) / 1e3);
      await namespace.put(key(session.sessionToken), JSON.stringify(stored), {
        expirationTtl: Math.max(ttl, 1)
      });
      return session;
    },
    async updateSession(session) {
      const existing = await namespace.get(key(session.sessionToken), { type: "json" });
      if (!existing) return null;
      const updated = {
        ...existing,
        ...session,
        expires: session.expires?.toISOString() ?? existing.expires
      };
      await namespace.put(key(session.sessionToken), JSON.stringify(updated));
      return {
        sessionToken: session.sessionToken,
        userId: updated.userId,
        expires: new Date(updated.expires)
      };
    },
    async deleteSession(sessionToken) {
      await namespace.delete(key(sessionToken));
    }
  };
}

export { CloudflareKVAdapter };
//# sourceMappingURL=cloudflare-kv.js.map
//# sourceMappingURL=cloudflare-kv.js.map