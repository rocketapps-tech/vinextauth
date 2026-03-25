import { deriveKey } from "../jwt/keys.js";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await deriveKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(sig));
}

/**
 * Generates a CSRF token and the cookie value to store.
 * Cookie value format: "{token}|{hmac(token, secret)}"
 */
export async function generateCsrfToken(secret: string): Promise<{ token: string; cookieValue: string }> {
  const token = randomHex(32);
  const hash = await hmacHex(secret, token);
  return { token, cookieValue: `${token}|${hash}` };
}

/**
 * Verifies that the submitted token matches the stored cookie value.
 */
export async function verifyCsrfToken(
  submittedToken: string,
  cookieValue: string,
  secret: string
): Promise<boolean> {
  const [storedToken] = cookieValue.split("|");
  if (storedToken !== submittedToken) return false;

  const expectedHash = await hmacHex(secret, storedToken);
  const expectedCookieValue = `${storedToken}|${expectedHash}`;

  // Constant-time comparison
  if (cookieValue.length !== expectedCookieValue.length) return false;

  let diff = 0;
  for (let i = 0; i < cookieValue.length; i++) {
    diff |= cookieValue.charCodeAt(i) ^ expectedCookieValue.charCodeAt(i);
  }
  return diff === 0;
}
