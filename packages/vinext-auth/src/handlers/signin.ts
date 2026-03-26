import type { ResolvedConfig, OAuthProvider } from '../types.js';
import { applyStateCookie, applyCallbackUrlCookie } from '../cookies/index.js';

function randomBase64url(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  const binary = String.fromCharCode(...arr);
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
  headers.set('Location', authUrl.toString());

  return new Response(null, { status: 302, headers });
}
