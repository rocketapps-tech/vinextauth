import type { ResolvedConfig, OAuthProvider } from '../types.js';
import { applyStateCookie, applyCallbackUrlCookie, applyPkceCookie } from '../cookies/index.js';

function randomBase64url(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  const binary = String.fromCharCode(...arr);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function handleSignIn(
  request: Request,
  providerId: string,
  config: ResolvedConfig
): Promise<Response> {
  const provider = config.providers.find((p) => p.id === providerId) as OAuthProvider | undefined;

  if (!provider) {
    return new Response(`Unknown provider: ${providerId}`, { status: 404 });
  }

  const url = new URL(request.url);
  const callbackUrl = url.searchParams.get('callbackUrl') ?? config.pages.newUser ?? '/';

  const state = randomBase64url(32);
  const redirectUri = `${config.baseUrl}${config.basePath}/callback/${providerId}`;

  const authUrl = new URL(provider.authorization.url);
  authUrl.searchParams.set('client_id', provider.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  // Merge provider default params
  const params = provider.authorization.params ?? {};
  for (const [key, value] of Object.entries(params)) {
    authUrl.searchParams.set(key, String(value));
  }

  const headers = new Headers();
  applyStateCookie(headers, state, config);
  applyCallbackUrlCookie(headers, callbackUrl, config);

  // PKCE — generate code_verifier + code_challenge for providers that require it
  if (provider.checks?.includes('pkce')) {
    const codeVerifier = randomBase64url(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    applyPkceCookie(headers, codeVerifier, config);
  }

  headers.set('Location', authUrl.toString());

  return new Response(null, { status: 302, headers });
}
