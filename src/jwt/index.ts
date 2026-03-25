import type { JWT } from "../types.js";
import { deriveKey } from "./keys.js";

// ─── Base64url helpers ────────────────────────────────────────────────────────

function base64urlEncode(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeJson(obj: unknown): string {
  return base64urlEncode(new TextEncoder().encode(JSON.stringify(obj)).buffer as ArrayBuffer);
}

function decodeJson(str: string): unknown {
  return JSON.parse(new TextDecoder().decode(base64urlDecode(str)));
}

// ─── JWT operations ───────────────────────────────────────────────────────────

const HEADER = encodeJson({ alg: "HS256", typ: "JWT" });

export async function sign(payload: JWT, secret: string): Promise<string> {
  const encodedPayload = encodeJson(payload);
  const message = `${HEADER}.${encodedPayload}`;

  const key = await deriveKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );

  return `${message}.${base64urlEncode(signature)}`;
}

export async function verify(token: string, secret: string): Promise<JWT | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, sig] = parts;
    const message = `${header}.${payload}`;

    const key = await deriveKey(secret);
    const signatureBytes = base64urlDecode(sig).buffer as ArrayBuffer;

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(message)
    );

    if (!valid) return null;

    const decoded = decodeJson(payload) as JWT;

    // Check expiry
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function decode(token: string): JWT | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return decodeJson(parts[1]) as JWT;
  } catch {
    return null;
  }
}
