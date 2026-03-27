import type { OAuthProvider, User } from '../types.js';

export interface MicrosoftProviderConfig {
  clientId: string;
  clientSecret: string;
  /**
   * Azure AD tenant ID.
   * - `"common"` — personal + work/school accounts (default)
   * - `"organizations"` — work/school accounts only
   * - `"consumers"` — personal accounts only
   * - `"<tenant-guid>"` — single tenant
   */
  tenantId?: string;
  authorization?: { params?: Record<string, string> };
}

export function MicrosoftProvider(config: MicrosoftProviderConfig): OAuthProvider {
  const tenant = config.tenantId ?? 'common';
  const base = `https://login.microsoftonline.com/${tenant}`;

  return {
    id: 'microsoft',
    name: 'Microsoft',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: `${base}/oauth2/v2.0/authorize`,
      params: {
        response_type: 'code',
        scope: 'openid email profile',
        ...config.authorization?.params,
      },
    },
    token: { url: `${base}/oauth2/v2.0/token` },
    userinfo: { url: 'https://graph.microsoft.com/oidc/userinfo' },
    profile(profile): User {
      return {
        id: profile.sub as string,
        name: profile.name as string | null,
        email: profile.email as string | null,
        image: null,
      };
    },
    checks: ['state'],
  };
}

export default MicrosoftProvider;
