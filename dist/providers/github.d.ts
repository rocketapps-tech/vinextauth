import { O as OAuthProvider } from '../types-G_m6Z3Iz.js';

interface GitHubProviderConfig {
    clientId: string;
    clientSecret: string;
    authorization?: {
        params?: Record<string, string>;
    };
}
declare function GitHubProvider(config: GitHubProviderConfig): OAuthProvider;

export { GitHubProvider, type GitHubProviderConfig, GitHubProvider as default };
