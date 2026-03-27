import { describe, it, expect } from 'vitest';
import { encodeSession, decodeSession, buildSession, buildJWT, generateId } from '../session.js';
import { resolveConfig } from '../config.js';
import type { DefaultUser, JWT, DefaultSession } from '../../types.js';

const TEST_SECRET = 'test-secret-32-chars-long-enough!!';
const BASE_URL = 'http://localhost:3001';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return resolveConfig({
    secret: TEST_SECRET,
    baseUrl: BASE_URL,
    providers: [],
    ...overrides,
  });
}

const TEST_USER: DefaultUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
};

const TEST_ACCOUNT = {
  provider: 'google',
  type: 'oauth' as const,
  providerAccountId: 'goog-123',
};

describe('encodeSession / decodeSession', () => {
  it('roundtrips a JWT payload through encode → decode', async () => {
    const config = makeConfig();
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: 'user-1',
      email: 'a@b.com',
      iat: now,
      exp: now + 3600,
      jti: 'test-jti',
    };
    const token = await encodeSession(payload, config);
    const decoded = await decodeSession(token, config);
    expect(decoded?.sub).toBe('user-1');
    expect(decoded?.email).toBe('a@b.com');
  });

  it('returns null for an expired token', async () => {
    const config = makeConfig();
    const now = Math.floor(Date.now() / 1000);
    const payload = { sub: 'user-1', iat: now - 7200, exp: now - 3600, jti: 'jti-x' };
    const token = await encodeSession(payload, config);
    const decoded = await decodeSession(token, config);
    expect(decoded).toBeNull();
  });

  it('returns null for a tampered token', async () => {
    const config = makeConfig();
    const now = Math.floor(Date.now() / 1000);
    const token = await encodeSession({ sub: 'user-1', exp: now + 3600, jti: 'x' }, config);
    const parts = token.split('.');
    parts[2] = 'tampered';
    expect(await decodeSession(parts.join('.'), config)).toBeNull();
  });

  it('uses custom encode/decode when provided in jwt config', async () => {
    const config = makeConfig({
      jwt: {
        encode: async ({ token }: { token: JWT }) => `custom.${JSON.stringify(token)}`,
        decode: async ({ token }: { token: string }) => JSON.parse(token.replace('custom.', '')),
      },
    });
    const now = Math.floor(Date.now() / 1000);
    const payload = { sub: 'user-2', exp: now + 3600, jti: 'jti-2' };
    const token = await encodeSession(payload, config);
    expect(token.startsWith('custom.')).toBe(true);
    const decoded = await decodeSession(token, config);
    expect(decoded?.sub).toBe('user-2');
  });
});

describe('buildJWT', () => {
  it('creates a JWT with user fields', async () => {
    const config = makeConfig();
    const jwt = await buildJWT(TEST_USER, TEST_ACCOUNT, undefined, config);
    expect(jwt.sub).toBe('user-123');
    expect(jwt.name).toBe('Test User');
    expect(jwt.email).toBe('test@example.com');
    expect(jwt.picture).toBeNull();
    expect(typeof jwt.iat).toBe('number');
    expect(typeof jwt.exp).toBe('number');
    expect(jwt.exp).toBeGreaterThan(jwt.iat!);
  });

  it('sets exp based on session.maxAge', async () => {
    const maxAge = 3600;
    const config = makeConfig({ session: { maxAge } });
    const before = Math.floor(Date.now() / 1000);
    const jwt = await buildJWT(TEST_USER, TEST_ACCOUNT, undefined, config);
    expect(jwt.exp).toBeGreaterThanOrEqual(before + maxAge - 1);
    expect(jwt.exp).toBeLessThanOrEqual(before + maxAge + 1);
  });

  it('calls the jwt callback when configured', async () => {
    const config = makeConfig({
      callbacks: {
        jwt({ token }: { token: JWT }) {
          return { ...token, role: 'admin' };
        },
      },
    });
    const jwt = await buildJWT(TEST_USER, TEST_ACCOUNT, undefined, config);
    expect((jwt as Record<string, unknown>).role).toBe('admin');
  });

  it('generates a unique jti for each call', async () => {
    const config = makeConfig();
    const jwt1 = await buildJWT(TEST_USER, TEST_ACCOUNT, undefined, config);
    const jwt2 = await buildJWT(TEST_USER, TEST_ACCOUNT, undefined, config);
    expect(jwt1.jti).not.toBe(jwt2.jti);
  });
});

describe('buildSession', () => {
  it('builds a session object from a JWT payload', async () => {
    const config = makeConfig();
    const now = Math.floor(Date.now() / 1000);
    const jwt = {
      sub: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      picture: 'https://example.com/pic.png',
      iat: now,
      exp: now + 3600,
      jti: 'test-jti',
    };
    const session = await buildSession(jwt, config);
    expect(session.user.id).toBe('user-1');
    expect(session.user.name).toBe('Alice');
    expect(session.user.email).toBe('alice@example.com');
    expect(session.user.image).toBe('https://example.com/pic.png');
    expect(typeof session.expires).toBe('string');
  });

  it('runs session callback and merges custom fields', async () => {
    const config = makeConfig({
      callbacks: {
        session({ session }: { session: DefaultSession }) {
          return { ...session, user: { ...session.user, role: 'admin' } };
        },
      },
    });
    const now = Math.floor(Date.now() / 1000);
    const jwt = { sub: 'user-1', email: 'a@b.com', iat: now, exp: now + 3600, jti: 'j' };
    const session = await buildSession(jwt, config);
    expect(
      (session as unknown as Record<string, unknown> & { user: Record<string, unknown> }).user.role
    ).toBe('admin');
  });
});

describe('generateId', () => {
  it('returns a hex string of 64 characters (256 bits)', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateId()));
    expect(ids.size).toBe(10);
  });
});
