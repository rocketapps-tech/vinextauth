import { describe, it, expect, beforeEach } from 'vitest';
import { CloudflareD1Adapter } from '../cloudflare-d1.js';

// ─── In-memory D1 stub ─────────────────────────────────────────────────────────

interface Row {
  [key: string]: unknown;
}

function makeD1() {
  const tables: Record<string, Row[]> = {
    users: [],
    sessions: [],
    verification_tokens: [],
    accounts: [],
  };

  function buildStmt(sql: string, bindings: unknown[] = []) {
    let bound = bindings;
    return {
      bind(...values: unknown[]) {
        bound = values;
        return this;
      },
      async first<T = Row>(): Promise<T | null> {
        return executeFirst<T>(sql, bound);
      },
      async run(): Promise<{ success: boolean }> {
        executeRun(sql, bound);
        return { success: true };
      },
      async all<T = Row>(): Promise<{ results: T[] }> {
        return { results: executeAll<T>(sql, bound) };
      },
    };
  }

  function executeFirst<T>(sql: string, values: unknown[]): T | null {
    const results = executeAll<T>(sql, values);
    return results[0] ?? null;
  }

  function executeAll<T>(sql: string, values: unknown[]): T[] {
    const s = sql.trim().toUpperCase();

    if (s.startsWith('SELECT') && s.includes('FROM SESSIONS')) {
      // Join query for getSession
      if (s.includes('JOIN USERS')) {
        const [token] = values as string[];
        const session = tables.sessions.find((r) => r.session_token === token);
        if (!session) return [];
        const user = tables.users.find((u) => u.id === session.user_id);
        return [
          {
            session_token: session.session_token,
            user_id: session.user_id,
            expires: session.expires,
            id: user?.id ?? session.user_id,
            name: user?.name ?? null,
            email: user?.email ?? null,
            image: user?.image ?? null,
          },
        ] as T[];
      }
    }

    if (s.startsWith('SELECT') && s.includes('FROM USERS')) {
      const [email] = values as string[];
      return tables.users.filter((u) => u.email === email) as T[];
    }

    if (s.startsWith('SELECT') && s.includes('FROM ACCOUNTS')) {
      const [provider, providerAccountId] = values as string[];
      return tables.accounts.filter(
        (a) => a.provider === provider && a.provider_account_id === providerAccountId
      ) as T[];
    }

    if (s.startsWith('SELECT') && s.includes('FROM VERIFICATION_TOKENS')) {
      const [identifier, token] = values as string[];
      return tables.verification_tokens.filter(
        (vt) => vt.identifier === identifier && vt.token === token
      ) as T[];
    }

    return [];
  }

  function executeRun(sql: string, values: unknown[]): void {
    const s = sql.trim().toUpperCase();

    if (s.startsWith('INSERT INTO USERS')) {
      const [id, name, email, image] = values as (string | null)[];
      tables.users.push({ id, name, email, image });
      return;
    }

    if (s.startsWith('INSERT INTO SESSIONS')) {
      const [sessionToken, userId, expires] = values as (string | number)[];
      tables.sessions.push({ session_token: sessionToken, user_id: userId, expires });
      return;
    }

    if (s.startsWith('UPDATE SESSIONS')) {
      const [expires, sessionToken] = values as (string | number)[];
      const session = tables.sessions.find((s) => s.session_token === sessionToken);
      if (session) session.expires = expires;
      return;
    }

    if (s.startsWith('DELETE FROM SESSIONS')) {
      const [token] = values as string[];
      const idx = tables.sessions.findIndex((s) => s.session_token === token);
      if (idx !== -1) tables.sessions.splice(idx, 1);
      return;
    }

    if (s.includes('INSERT') && s.includes('INTO ACCOUNTS')) {
      const [id, userId, provider, providerAccountId] = values as string[];
      const exists = tables.accounts.some(
        (a) => a.provider === provider && a.provider_account_id === providerAccountId
      );
      if (!exists) {
        tables.accounts.push({
          id,
          user_id: userId,
          provider,
          provider_account_id: providerAccountId,
        });
      }
      return;
    }

    if (s.startsWith('INSERT INTO VERIFICATION_TOKENS')) {
      const [identifier, token, expires] = values as (string | number)[];
      tables.verification_tokens.push({ identifier, token, expires });
      return;
    }

    if (s.startsWith('DELETE FROM VERIFICATION_TOKENS')) {
      const [identifier, token] = values as string[];
      const idx = tables.verification_tokens.findIndex(
        (vt) => vt.identifier === identifier && vt.token === token
      );
      if (idx !== -1) tables.verification_tokens.splice(idx, 1);
      return;
    }
  }

  return {
    prepare(sql: string) {
      return buildStmt(sql);
    },
    _tables: tables,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('CloudflareD1Adapter — sessions', () => {
  let db: ReturnType<typeof makeD1>;
  let adapter: ReturnType<typeof CloudflareD1Adapter>;

  beforeEach(() => {
    db = makeD1();
    adapter = CloudflareD1Adapter(db);
  });

  it('createSession stores and returns the session', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    const session = { sessionToken: 'tok-1', userId: 'usr-1', expires };
    const result = await adapter.createSession(session);
    expect(result.sessionToken).toBe('tok-1');
    expect(result.userId).toBe('usr-1');
  });

  it('getSession returns null for missing token', async () => {
    const result = await adapter.getSession('nonexistent');
    expect(result).toBeNull();
  });

  it('getSession returns stored session with Date expires', async () => {
    // Manually insert a user and session row
    db._tables.users.push({ id: 'usr-1', name: 'Alice', email: 'alice@example.com', image: null });
    const expiresUnix = Math.floor((Date.now() + 3600 * 1000) / 1000);
    db._tables.sessions.push({ session_token: 'tok-1', user_id: 'usr-1', expires: expiresUnix });

    const result = await adapter.getSession('tok-1');
    expect(result).not.toBeNull();
    expect(result?.sessionToken).toBe('tok-1');
    expect(result?.expires).toBeInstanceOf(Date);
    expect(result?.user?.email).toBe('alice@example.com');
  });

  it('updateSession modifies expires', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    await adapter.createSession({ sessionToken: 'tok-2', userId: 'usr-2', expires });

    const newExpires = new Date(Date.now() + 7200 * 1000);
    const result = await adapter.updateSession({ sessionToken: 'tok-2', expires: newExpires });
    expect(result?.sessionToken).toBe('tok-2');
  });

  it('deleteSession removes the session', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    db._tables.users.push({ id: 'usr-3', name: 'Bob', email: 'bob@example.com', image: null });
    const expiresUnix = Math.floor(expires.getTime() / 1000);
    db._tables.sessions.push({ session_token: 'tok-3', user_id: 'usr-3', expires: expiresUnix });

    await adapter.deleteSession('tok-3');
    const result = await adapter.getSession('tok-3');
    expect(result).toBeNull();
  });
});

describe('CloudflareD1Adapter — users', () => {
  let db: ReturnType<typeof makeD1>;
  let adapter: ReturnType<typeof CloudflareD1Adapter>;

  beforeEach(() => {
    db = makeD1();
    adapter = CloudflareD1Adapter(db);
  });

  it('getUserByEmail returns null when not found', async () => {
    const result = await adapter.getUserByEmail!('nobody@example.com');
    expect(result).toBeNull();
  });

  it('createUser generates an id and returns the user', async () => {
    const user = { name: 'Carol', email: 'carol@example.com', image: null };
    const created = await adapter.createUser!(user);
    expect(typeof created.id).toBe('string');
    expect(created.email).toBe('carol@example.com');
  });

  it('getUserByEmail returns the user after createUser', async () => {
    await adapter.createUser!({ name: 'Dave', email: 'dave@example.com', image: null });
    const result = await adapter.getUserByEmail!('dave@example.com');
    expect(result?.email).toBe('dave@example.com');
  });
});

describe('CloudflareD1Adapter — account linking', () => {
  let db: ReturnType<typeof makeD1>;
  let adapter: ReturnType<typeof CloudflareD1Adapter>;

  beforeEach(() => {
    db = makeD1();
    adapter = CloudflareD1Adapter(db);
  });

  it('linkAccount stores account link', async () => {
    await adapter.linkAccount('usr-1', 'google', 'goog-123');
    const result = await adapter.getAccountByProvider('google', 'goog-123');
    expect(result?.userId).toBe('usr-1');
  });

  it('getAccountByProvider returns null when not found', async () => {
    const result = await adapter.getAccountByProvider('github', 'gh-999');
    expect(result).toBeNull();
  });

  it('INSERT OR IGNORE does not overwrite existing accounts', async () => {
    await adapter.linkAccount('usr-1', 'google', 'goog-abc');
    await adapter.linkAccount('usr-2', 'google', 'goog-abc'); // same provider+providerAccountId
    const result = await adapter.getAccountByProvider('google', 'goog-abc');
    expect(result?.userId).toBe('usr-1'); // first one wins
  });
});

describe('CloudflareD1Adapter — verification tokens', () => {
  let db: ReturnType<typeof makeD1>;
  let adapter: ReturnType<typeof CloudflareD1Adapter>;

  beforeEach(() => {
    db = makeD1();
    adapter = CloudflareD1Adapter(db);
  });

  it('createVerificationToken stores the token', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    const vt = { identifier: 'user@example.com', token: 'magic-abc', expires };
    const result = await adapter.createVerificationToken(vt);
    expect(result.token).toBe('magic-abc');
  });

  it('useVerificationToken returns and deletes the token (one-time use)', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    await adapter.createVerificationToken({ identifier: 'a@b.com', token: 'otp-xyz', expires });

    const result = await adapter.useVerificationToken({ identifier: 'a@b.com', token: 'otp-xyz' });
    expect(result).not.toBeNull();
    expect(result?.token).toBe('otp-xyz');
    expect(result?.expires).toBeInstanceOf(Date);

    // Second use should return null
    const second = await adapter.useVerificationToken({ identifier: 'a@b.com', token: 'otp-xyz' });
    expect(second).toBeNull();
  });

  it('useVerificationToken returns null for nonexistent token', async () => {
    const result = await adapter.useVerificationToken({
      identifier: 'nobody@example.com',
      token: 'ghost',
    });
    expect(result).toBeNull();
  });
});
