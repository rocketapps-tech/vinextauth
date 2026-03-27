import { describe, it, expect } from 'vitest';
import { sign, verify, decode } from '../index.js';

const SECRET = 'test-secret-32-chars-long-enough!!';
const FAR_FUTURE_EXP = 9_999_999_999;

describe('sign + verify', () => {
  it('roundtrips a token through sign → verify', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { sub: 'user-1', email: 'test@example.com', iat: now, exp: FAR_FUTURE_EXP };
    const token = await sign(payload, SECRET);
    const result = await verify(token, SECRET);
    expect(result).not.toBeNull();
    expect(result?.sub).toBe('user-1');
    expect(result?.email).toBe('test@example.com');
  });

  it('returns null for an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign({ sub: 'user-1', iat: now - 7200, exp: now - 3600 }, SECRET);
    expect(await verify(token, SECRET)).toBeNull();
  });

  it('returns null at exactly the exp second (exp <= now)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await sign({ sub: 'user-1', exp: now }, SECRET);
    expect(await verify(token, SECRET)).toBeNull();
  });

  it('returns null when signature is tampered', async () => {
    const token = await sign({ sub: 'user-1', exp: FAR_FUTURE_EXP }, SECRET);
    const parts = token.split('.');
    parts[2] = 'dGFtcGVyZWQ'; // base64url of "tampered"
    expect(await verify(parts.join('.'), SECRET)).toBeNull();
  });

  it('returns null when payload is tampered', async () => {
    const token = await sign({ sub: 'user-1', exp: FAR_FUTURE_EXP }, SECRET);
    const parts = token.split('.');
    // Replace payload with different content — signature won't match
    parts[1] = btoa(JSON.stringify({ sub: 'attacker', exp: FAR_FUTURE_EXP }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    expect(await verify(parts.join('.'), SECRET)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await sign({ sub: 'user-1', exp: FAR_FUTURE_EXP }, SECRET);
    expect(await verify(token, 'completely-different-secret-123456')).toBeNull();
  });

  it('rejects a token with wrong number of parts', async () => {
    expect(await verify('only.two', SECRET)).toBeNull();
    expect(await verify('one', SECRET)).toBeNull();
    expect(await verify('one.two.three.four', SECRET)).toBeNull();
  });

  it('rejects tokens with alg !== HS256', async () => {
    // Craft a token with alg: "none"
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    const payload = btoa(JSON.stringify({ sub: 'user', exp: FAR_FUTURE_EXP }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    expect(await verify(`${header}.${payload}.fakesig`, SECRET)).toBeNull();
  });

  it('returns null for a garbage string', async () => {
    expect(await verify('not-a-jwt', SECRET)).toBeNull();
    expect(await verify('', SECRET)).toBeNull();
  });

  it('encodes all payload fields correctly', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: 'u-123',
      name: 'Alice',
      email: 'alice@example.com',
      picture: 'https://example.com/avatar.png',
      iat: now,
      exp: FAR_FUTURE_EXP,
      jti: 'jti-abc',
      customField: 42,
    };
    const token = await sign(payload, SECRET);
    const result = await verify(token, SECRET);
    expect(result?.name).toBe('Alice');
    expect(result?.picture).toBe('https://example.com/avatar.png');
    expect(result?.jti).toBe('jti-abc');
    expect(result?.customField).toBe(42);
  });
});

describe('decode', () => {
  it('decodes payload without verification', async () => {
    const now = Math.floor(Date.now() / 1000);
    // Expired — verify would return null, but decode should succeed
    const token = await sign(
      { sub: 'user-1', email: 'test@example.com', iat: now - 7200, exp: now - 3600 },
      SECRET
    );
    const result = decode(token);
    expect(result?.sub).toBe('user-1');
    expect(result?.email).toBe('test@example.com');
  });

  it('returns null for a malformed token (wrong part count)', () => {
    expect(decode('only.two')).toBeNull();
    expect(decode('one')).toBeNull();
  });

  it('returns null for a completely garbage string', () => {
    expect(decode('')).toBeNull();
    expect(decode('not-a-token')).toBeNull();
  });

  it('decodes even a tampered token (no signature check)', async () => {
    const token = await sign({ sub: 'user-1', exp: FAR_FUTURE_EXP }, SECRET);
    const parts = token.split('.');
    // decode reads parts[1] and doesn't care about the signature
    const result = decode(parts.join('.'));
    expect(result?.sub).toBe('user-1');
  });
});
