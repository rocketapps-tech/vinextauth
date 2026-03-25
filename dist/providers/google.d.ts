import { O as OAuthProvider } from '../types-G_m6Z3Iz.js';

interface GoogleProviderConfig {
    clientId: string;
    clientSecret: string;
    authorization?: {
        params?: Record<string, string>;
    };
}
declare function GoogleProvider(config: GoogleProviderConfig): OAuthProvider;

export { GoogleProvider, type GoogleProviderConfig, GoogleProvider as default };
