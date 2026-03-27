import type { OAuthProvider, User } from '../types.js';

export interface SpotifyProviderConfig {
  clientId: string;
  clientSecret: string;
  authorization?: { params?: Record<string, string> };
}

export function SpotifyProvider(config: SpotifyProviderConfig): OAuthProvider {
  return {
    id: 'spotify',
    name: 'Spotify',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://accounts.spotify.com/authorize',
      params: {
        response_type: 'code',
        scope: 'user-read-email user-read-private',
        ...config.authorization?.params,
      },
    },
    token: { url: 'https://accounts.spotify.com/api/token' },
    userinfo: { url: 'https://api.spotify.com/v1/me' },
    profile(profile): User {
      const images = profile.images as Array<{ url: string }> | null;
      return {
        id: profile.id as string,
        name: profile.display_name as string | null,
        email: profile.email as string | null,
        image: images?.[0]?.url ?? null,
      };
    },
    checks: ['state'],
  };
}

export default SpotifyProvider;
