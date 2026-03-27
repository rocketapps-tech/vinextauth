import type { OAuthProvider, User } from '../types.js';

export interface TwitterProviderConfig {
  clientId: string;
  clientSecret: string;
  authorization?: { params?: Record<string, string> };
}

/**
 * Twitter / X provider — OAuth 2.0 with PKCE.
 *
 * Required scopes: `tweet.read users.read offline.access`
 * Requires `checks: ['pkce', 'state']` — PKCE is mandatory for public clients.
 *
 * App setup: https://developer.twitter.com/en/portal/dashboard
 * - Type of App: Web App, Automated App or Bot
 * - Enable OAuth 2.0 + set callback URL to your redirect URI
 */
export function TwitterProvider(config: TwitterProviderConfig): OAuthProvider {
  return {
    id: 'twitter',
    name: 'Twitter',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://twitter.com/i/oauth2/authorize',
      params: {
        response_type: 'code',
        scope: 'tweet.read users.read offline.access',
        ...config.authorization?.params,
      },
    },
    token: { url: 'https://api.twitter.com/2/oauth2/token' },
    userinfo: {
      url: 'https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url',
    },
    profile(profile): User {
      const user = (profile.data as Record<string, unknown> | null) ?? profile;
      return {
        id: user.id as string,
        name: (user.name as string | null) ?? (user.username as string | null),
        email: null, // Twitter OAuth 2.0 does not expose email
        image: (user.profile_image_url as string | null)?.replace('_normal', '') ?? null,
      };
    },
    checks: ['pkce', 'state'],
  };
}

export default TwitterProvider;
