import type { OAuthProvider, User } from '../types.js';

export interface TwitchProviderConfig {
  clientId: string;
  clientSecret: string;
  authorization?: { params?: Record<string, string> };
}

export function TwitchProvider(config: TwitchProviderConfig): OAuthProvider {
  return {
    id: 'twitch',
    name: 'Twitch',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://id.twitch.tv/oauth2/authorize',
      params: {
        response_type: 'code',
        scope: 'user:read:email',
        ...config.authorization?.params,
      },
    },
    token: { url: 'https://id.twitch.tv/oauth2/token' },
    userinfo: { url: 'https://api.twitch.tv/helix/users' },
    profile(profile): User {
      // Twitch wraps the user object inside a `data` array
      const user = (profile.data as Array<Record<string, unknown>>)?.[0] ?? profile;
      return {
        id: user.id as string,
        name: (user.display_name as string | null) ?? (user.login as string | null),
        email: user.email as string | null,
        image: user.profile_image_url as string | null,
      };
    },
    checks: ['state'],
  };
}

export default TwitchProvider;
