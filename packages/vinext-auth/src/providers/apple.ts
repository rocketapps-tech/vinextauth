import type { OAuthProvider, User } from '../types.js';

export interface AppleProviderConfig {
  /**
   * Services ID (e.g. com.yourapp.signin) — registered in Apple Developer Portal.
   */
  clientId: string;
  /**
   * 10-character Team ID from Apple Developer account.
   */
  teamId: string;
  /**
   * Key ID from the Sign in with Apple key registered in the Developer Portal.
   */
  keyId: string;
  /**
   * Contents of the .p8 private key file downloaded from Apple Developer Portal.
   * Include the full PEM header/footer, e.g.:
   * `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"`
   */
  privateKey: string;
  authorization?: { params?: Record<string, string> };
}

/**
 * Convert a PEM-encoded PKCS#8 private key to DER (raw bytes).
 * Strips the PEM header/footer and base64-decodes the body.
 */
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN .*-----/, '')
    .replace(/-----END .*-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate a short-lived JWT client secret for Apple Sign In.
 *
 * Apple requires the client_secret to be a JWT signed with ES256 using the
 * P-256 private key from the Developer Portal. The token is valid for 6 months
 * at most; here we use 5 minutes to minimize exposure per request.
 *
 * Reference: https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
 */
async function createAppleClientSecret(
  teamId: string,
  clientId: string,
  keyId: string,
  privateKeyPem: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'ES256', kid: keyId };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 300, // 5 minutes — minimal exposure per sign-in attempt
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Apple Sign In provider.
 *
 * Special requirements:
 * - The `client_secret` is a short-lived JWT generated per request (ES256).
 * - Apple returns user data only on the *first* sign-in; subsequent logins omit it.
 * - Requires `response_mode=form_post` — Apple POSTs back to the callback URL.
 *
 * @example
 * ```ts
 * import { AppleProvider } from "vinextauth/providers/apple"
 *
 * VinextAuth({
 *   providers: [
 *     AppleProvider({
 *       clientId: env.APPLE_CLIENT_ID,
 *       teamId: env.APPLE_TEAM_ID,
 *       keyId: env.APPLE_KEY_ID,
 *       privateKey: env.APPLE_PRIVATE_KEY,
 *     }),
 *   ],
 * })
 * ```
 */
export function AppleProvider(config: AppleProviderConfig): OAuthProvider {
  return {
    id: 'apple',
    name: 'Apple',
    type: 'oauth',
    clientId: config.clientId,
    // clientSecret is unused — clientSecretFactory generates it dynamically
    clientSecret: '',
    clientSecretFactory: () =>
      createAppleClientSecret(config.teamId, config.clientId, config.keyId, config.privateKey),
    authorization: {
      url: 'https://appleid.apple.com/auth/authorize',
      params: {
        response_type: 'code',
        response_mode: 'form_post',
        scope: 'name email',
        ...config.authorization?.params,
      },
    },
    token: { url: 'https://appleid.apple.com/auth/token' },
    userinfo: { url: 'https://appleid.apple.com/auth/token' }, // userinfo comes from id_token
    profile(profile): User {
      // Apple returns an id_token; the profile object here is the decoded id_token payload
      return {
        id: profile.sub as string,
        name:
          profile.name != null
            ? `${(profile.name as { firstName?: string }).firstName ?? ''} ${(profile.name as { lastName?: string }).lastName ?? ''}`.trim() ||
              null
            : null,
        email: profile.email as string | null,
        image: null,
      };
    },
    checks: ['state'],
  };
}

export default AppleProvider;
