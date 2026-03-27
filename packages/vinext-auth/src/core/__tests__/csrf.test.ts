import { describe, it, expect } from 'vitest';
import { generateCsrfToken, verifyCsrfToken } from '../csrf.js';

const SECRET = 'test-secret-32-chars-long-enough!!';

describe('generateCsrfToken', () => {
  it('returns a token and cookieValue', async () => {
    const result = await generateCsrfToken(SECRET);
    expect(typeof result.token).toBe('string');
    expect(typeof result.cookieValue).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
    expect(result.cookieValue).toContain('|');
  });

  it('cookieValue format is {token}|{hmac}', async () => {
    const { token, cookieValue } = await generateCsrfToken(SECRET);
    const [storedToken, hmac] = cookieValue.split('|');
    expect(storedToken).toBe(token);
    expect(hmac).toBeTruthy();
    expect(hmac.length).toBeGreaterThan(0);
  });

  it('generates unique tokens each time', async () => {
    const a = await generateCsrfToken(SECRET);
    const b = await generateCsrfToken(SECRET);
    expect(a.token).not.toBe(b.token);
    expect(a.cookieValue).not.toBe(b.cookieValue);
  });

  it('token is hex string (64 chars for 32 bytes)', async () => {
    const { token } = await generateCsrfToken(SECRET);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyCsrfToken', () => {
  it('accepts a valid cookie + token pair', async () => {
    const { token, cookieValue } = await generateCsrfToken(SECRET);
    const valid = await verifyCsrfToken(token, cookieValue, SECRET);
    expect(valid).toBe(true);
  });

  it('rejects a mismatched submitted token', async () => {
    const { cookieValue } = await generateCsrfToken(SECRET);
    const { token: wrongToken } = await generateCsrfToken(SECRET);
    const valid = await verifyCsrfToken(wrongToken, cookieValue, SECRET);
    expect(valid).toBe(false);
  });

  it('rejects a tampered HMAC in cookieValue', async () => {
    const { token, cookieValue } = await generateCsrfToken(SECRET);
    const [storedToken] = cookieValue.split('|');
    const tampered = `${storedToken}|deadbeefdeadbeef`;
    const valid = await verifyCsrfToken(token, tampered, SECRET);
    expect(valid).toBe(false);
  });

  it('rejects a tampered token in cookieValue', async () => {
    const { token, cookieValue } = await generateCsrfToken(SECRET);
    const [, hmac] = cookieValue.split('|');
    // Token in cookie doesn't match submitted token AND doesn't match the HMAC
    const tampered = `differenttoken|${hmac}`;
    const valid = await verifyCsrfToken(token, tampered, SECRET);
    expect(valid).toBe(false);
  });

  it('rejects when signed with a different secret', async () => {
    const { token, cookieValue } = await generateCsrfToken(SECRET);
    const valid = await verifyCsrfToken(token, cookieValue, 'different-secret-entirely-12345');
    expect(valid).toBe(false);
  });

  it('rejects mismatched cookie value lengths', async () => {
    const { token } = await generateCsrfToken(SECRET);
    // cookieValue is shorter than expected
    const valid = await verifyCsrfToken(token, `${token}|short`, SECRET);
    expect(valid).toBe(false);
  });
});
