import type { OAuthProvider, User } from '../types.js';

export interface DiscordProviderConfig {
  clientId: string;
  clientSecret: string;
  authorization?: { params?: Record<string, string> };
}

export function DiscordProvider(config: DiscordProviderConfig): OAuthProvider {
  return {
    id: 'discord',
    name: 'Discord',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://discord.com/api/oauth2/authorize',
      params: {
        response_type: 'code',
        scope: 'identify email',
        ...config.authorization?.params,
      },
    },
    token: { url: 'https://discord.com/api/oauth2/token' },
    userinfo: { url: 'https://discord.com/api/users/@me' },
    profile(profile): User {
      return {
        id: profile.id as string,
        name: profile.username as string | null,
        email: profile.email as string | null,
        image: profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id as string}/${profile.avatar as string}.png`
          : null,
      };
    },
    checks: ['state'],
  };
}

export default DiscordProvider;
