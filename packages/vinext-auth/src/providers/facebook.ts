import type { OAuthProvider, User } from '../types.js';

export interface FacebookProviderConfig {
  clientId: string;
  clientSecret: string;
  authorization?: { params?: Record<string, string> };
}

export function FacebookProvider(config: FacebookProviderConfig): OAuthProvider {
  return {
    id: 'facebook',
    name: 'Facebook',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://www.facebook.com/v19.0/dialog/oauth',
      params: {
        response_type: 'code',
        scope: 'email,public_profile',
        ...config.authorization?.params,
      },
    },
    token: { url: 'https://graph.facebook.com/v19.0/oauth/access_token' },
    userinfo: {
      url: 'https://graph.facebook.com/me?fields=id,name,email,picture.width(200).height(200)',
    },
    profile(profile): User {
      return {
        id: profile.id as string,
        name: profile.name as string | null,
        email: profile.email as string | null,
        image: (profile.picture as { data?: { url?: string } } | null)?.data?.url ?? null,
      };
    },
    checks: ['state'],
  };
}

export default FacebookProvider;
