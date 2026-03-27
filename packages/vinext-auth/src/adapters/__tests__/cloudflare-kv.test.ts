import { describe, it, expect, beforeEach } from 'vitest';
import { CloudflareKVAdapter } from '../cloudflare-kv.js';

// ─── In-memory KV stub ────────────────────────────────────────────────────────

function makeKV() {
  const store = new Map<string, string>();

  return {
    async get(key: string, options: { type: 'json' }): Promise<unknown> {
      const raw = store.get(key);
      if (!raw) return null;
      if (options?.type === 'json') return JSON.parse(raw);
      return raw;
    },
    async put(key: string, value: string, _options?: { expirationTtl?: number }): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    _store: store,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CloudflareKVAdapter — sessions', () => {
  let kv: ReturnType<typeof makeKV>;
  let adapter: ReturnType<typeof CloudflareKVAdapter>;

  beforeEach(() => {
    kv = makeKV();
    adapter = CloudflareKVAdapter(kv);
  });

  it('createSession stores session and returns it', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    const session = { sessionToken: 'token-abc', userId: 'user-1', expires };
    const result = await adapter.createSession!(session);
    expect(result.sessionToken).toBe('token-abc');
    expect(result.userId).toBe('user-1');
  });

  it('getSession returns null for missing token', async () => {
    const result = await adapter.getSession!('nonexistent');
    expect(result).toBeNull();
  });

  it('getSession returns stored session with Date expires', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    await adapter.createSession!({ sessionToken: 'tok-1', userId: 'usr-1', expires });
    const result = await adapter.getSession!('tok-1');
    expect(result).not.toBeNull();
    expect(result?.sessionToken).toBe('tok-1');
    expect(result?.userId).toBe('usr-1');
    expect(result?.expires).toBeInstanceOf(Date);
  });

  it('getSession includes user when user was created first', async () => {
    const user = { name: 'Alice', email: 'alice@example.com', image: null };
    const created = await adapter.createUser!(user);

    const expires = new Date(Date.now() + 3600 * 1000);
    await adapter.createSession!({ sessionToken: 'tok-user', userId: created.id, expires });

    const session = await adapter.getSession!('tok-user');
    expect(session?.user?.email).toBe('alice@example.com');
  });

  it('updateSession modifies expires and returns updated session', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    await adapter.createSession!({ sessionToken: 'tok-2', userId: 'usr-2', expires });

    const newExpires = new Date(Date.now() + 7200 * 1000);
    const result = await adapter.updateSession!({
      sessionToken: 'tok-2',
      userId: 'usr-2',
      expires: newExpires,
    });
    expect(result).not.toBeNull();
    expect(result?.expires.getTime()).toBeGreaterThan(expires.getTime());
  });

  it('updateSession returns null for nonexistent session', async () => {
    const result = await adapter.updateSession!({
      sessionToken: 'ghost',
      userId: 'usr-x',
      expires: new Date(),
    });
    expect(result).toBeNull();
  });

  it('deleteSession removes the session', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    await adapter.createSession!({ sessionToken: 'tok-3', userId: 'usr-3', expires });
    await adapter.deleteSession!('tok-3');
    const result = await adapter.getSession!('tok-3');
    expect(result).toBeNull();
  });
});

describe('CloudflareKVAdapter — users', () => {
  let kv: ReturnType<typeof makeKV>;
  let adapter: ReturnType<typeof CloudflareKVAdapter>;

  beforeEach(() => {
    kv = makeKV();
    adapter = CloudflareKVAdapter(kv);
  });

  it('createUser generates an id and stores the user', async () => {
    const user = { name: 'Bob', email: 'bob@example.com', image: null };
    const created = await adapter.createUser!(user);
    expect(typeof created.id).toBe('string');
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.email).toBe('bob@example.com');
  });

  it('createUser stores email index', async () => {
    await adapter.createUser!({ name: 'Carol', email: 'carol@example.com', image: null });
    const found = await adapter.getUserByEmail!('carol@example.com');
    expect(found?.email).toBe('carol@example.com');
  });

  it('getUserByEmail returns null when email not found', async () => {
    const result = await adapter.getUserByEmail!('nobody@example.com');
    expect(result).toBeNull();
  });

  it('getUserByEmail is case-insensitive for the index', async () => {
    await adapter.createUser!({ name: 'Dave', email: 'DAVE@example.com', image: null });
    // The adapter lowercases the email index
    const result = await adapter.getUserByEmail!('dave@example.com');
    expect(result).not.toBeNull();
  });

  it('createUser with null email does not create email index', async () => {
    await adapter.createUser!({ name: 'Anonymous', email: null, image: null });
    const result = await adapter.getUserByEmail!('');
    expect(result).toBeNull();
  });
});

describe('CloudflareKVAdapter — account linking', () => {
  let kv: ReturnType<typeof makeKV>;
  let adapter: ReturnType<typeof CloudflareKVAdapter>;

  beforeEach(() => {
    kv = makeKV();
    adapter = CloudflareKVAdapter(kv);
  });

  it('linkAccount stores an account lookup', async () => {
    await adapter.linkAccount!('user-1', 'google', 'goog-123');
    const result = await adapter.getAccountByProvider!('google', 'goog-123');
    expect(result?.userId).toBe('user-1');
  });

  it('getAccountByProvider returns null when no account is linked', async () => {
    const result = await adapter.getAccountByProvider!('github', 'gh-999');
    expect(result).toBeNull();
  });

  it('different providers are independent', async () => {
    await adapter.linkAccount!('user-1', 'google', 'shared-id');
    await adapter.linkAccount!('user-2', 'github', 'shared-id');
    const google = await adapter.getAccountByProvider!('google', 'shared-id');
    const github = await adapter.getAccountByProvider!('github', 'shared-id');
    expect(google?.userId).toBe('user-1');
    expect(github?.userId).toBe('user-2');
  });
});

describe('CloudflareKVAdapter — verification tokens', () => {
  let kv: ReturnType<typeof makeKV>;
  let adapter: ReturnType<typeof CloudflareKVAdapter>;

  beforeEach(() => {
    kv = makeKV();
    adapter = CloudflareKVAdapter(kv);
  });

  it('createVerificationToken stores the token', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    const vt = { identifier: 'user@example.com', token: 'magic-token-xyz', expires };
    const result = await adapter.createVerificationToken!(vt);
    expect(result.identifier).toBe('user@example.com');
    expect(result.token).toBe('magic-token-xyz');
  });

  it('useVerificationToken returns and deletes the token', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    await adapter.createVerificationToken!({ identifier: 'a@b.com', token: 'tok-abc', expires });

    const result = await adapter.useVerificationToken!({ identifier: 'a@b.com', token: 'tok-abc' });
    expect(result).not.toBeNull();
    expect(result?.token).toBe('tok-abc');
    expect(result?.expires).toBeInstanceOf(Date);

    // Second use should return null (one-time use)
    const second = await adapter.useVerificationToken!({ identifier: 'a@b.com', token: 'tok-abc' });
    expect(second).toBeNull();
  });

  it('useVerificationToken returns null for nonexistent token', async () => {
    const result = await adapter.useVerificationToken!({
      identifier: 'nobody@example.com',
      token: 'ghost-token',
    });
    expect(result).toBeNull();
  });

  it('identifier lookup is case-insensitive', async () => {
    const expires = new Date(Date.now() + 3600 * 1000);
    await adapter.createVerificationToken!({
      identifier: 'USER@EXAMPLE.COM',
      token: 'case-tok',
      expires,
    });
    const result = await adapter.useVerificationToken!({
      identifier: 'user@example.com',
      token: 'case-tok',
    });
    expect(result).not.toBeNull();
  });
});
