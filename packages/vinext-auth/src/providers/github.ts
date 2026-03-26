import type { OAuthProvider, User } from '../types.js';

export interface GitHubProviderConfig {
  clientId: string;
  clientSecret: string;
  authorization?: {
    params?: Record<string, string>;
  };
}

export function GitHubProvider(config: GitHubProviderConfig): OAuthProvider {
  const clientId = config.clientId ?? process.env.GITHUB_CLIENT_ID ?? '';
  const clientSecret = config.clientSecret ?? process.env.GITHUB_CLIENT_SECRET ?? '';

  return {
    id: 'github',
    name: 'GitHub',
    type: 'oauth',
    clientId,
    clientSecret,
    authorization: {
      url: 'https://github.com/login/oauth/authorize',
      params: {
        response_type: 'code',
        scope: 'read:user user:email',
        ...config.authorization?.params,
      },
    },
    token: {
      url: 'https://github.com/login/oauth/access_token',
    },
    userinfo: {
      url: 'https://api.github.com/user',
    },
    profile(profile: Record<string, unknown>): User {
      return {
        id: String(profile.id),
        name: (profile.name as string | null) ?? (profile.login as string | null),
        email: profile.email as string | null,
        image: profile.avatar_url as string | null,
      };
    },
    checks: ['state'],
    scope: 'read:user user:email',
  };
}

export default GitHubProvider;
