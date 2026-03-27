import type { OAuthProvider, User } from '../types.js';

export interface LinkedInProviderConfig {
  clientId: string;
  clientSecret: string;
  authorization?: { params?: Record<string, string> };
}

export function LinkedInProvider(config: LinkedInProviderConfig): OAuthProvider {
  return {
    id: 'linkedin',
    name: 'LinkedIn',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://www.linkedin.com/oauth/v2/authorization',
      params: {
        response_type: 'code',
        scope: 'openid profile email',
        ...config.authorization?.params,
      },
    },
    token: { url: 'https://www.linkedin.com/oauth/v2/accessToken' },
    // LinkedIn OIDC userinfo endpoint (requires openid scope)
    userinfo: { url: 'https://api.linkedin.com/v2/userinfo' },
    profile(profile): User {
      return {
        id: profile.sub as string,
        name: profile.name as string | null,
        email: profile.email as string | null,
        image: profile.picture as string | null,
      };
    },
    checks: ['state'],
  };
}

export default LinkedInProvider;
