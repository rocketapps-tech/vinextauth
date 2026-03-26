import type { OAuthProvider, User } from '../types.js';

export interface GoogleProviderConfig {
  clientId: string;
  clientSecret: string;
  authorization?: {
    params?: Record<string, string>;
  };
}

export function GoogleProvider(config: GoogleProviderConfig): OAuthProvider {
  const clientId = config.clientId ?? process.env.GOOGLE_CLIENT_ID ?? '';
  const clientSecret = config.clientSecret ?? process.env.GOOGLE_CLIENT_SECRET ?? '';

  return {
    id: 'google',
    name: 'Google',
    type: 'oauth',
    clientId,
    clientSecret,
    authorization: {
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
      params: {
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'select_account',
        ...config.authorization?.params,
      },
    },
    token: {
      url: 'https://oauth2.googleapis.com/token',
    },
    userinfo: {
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    },
    profile(profile: Record<string, unknown>): User {
      return {
        id: profile.id as string,
        name: profile.name as string | null,
        email: profile.email as string | null,
        image: profile.picture as string | null,
      };
    },
    checks: ['state'],
    scope: 'openid email profile',
  };
}

// Default export for convenience: GoogleProvider({ clientId, clientSecret })
export default GoogleProvider;
