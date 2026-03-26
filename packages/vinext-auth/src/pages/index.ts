import type { ThemeConfig } from '../types.js';

export interface SignInProvider {
  id: string;
  name: string;
  signinUrl: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeCssColor(value: string): string {
  // Allow only hex colors, named colors, and rgb/hsl — block everything else
  return /^#[0-9a-fA-F]{3,8}$|^[a-zA-Z]+$|^rgb|^hsl/.test(value) ? value : '#3182ce';
}

function safeImageUrl(url: string): string {
  // Allow only https:// and data: image URLs
  return url.startsWith('https://') || url.startsWith('data:image/') ? url : '';
}

export function renderSignInPage(
  providers: SignInProvider[],
  callbackUrl: string,
  theme: Required<ThemeConfig>
): string {
  const brandName = escapeHtml(theme.brandName || 'Sign In');

  const safeLogoUrl = safeImageUrl(theme.logoUrl);
  const logo = safeLogoUrl
    ? `<img src="${safeLogoUrl}" alt="${brandName}" style="height:40px;margin-bottom:8px;">`
    : '';

  const providerLinks = providers
    .map(
      (p) => `
    <a href="${p.signinUrl}?callbackUrl=${encodeURIComponent(callbackUrl)}" class="provider-btn">
      Sign in with ${p.name}
    </a>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sign In${brandName !== 'Sign In' ? ` — ${brandName}` : ''}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f7fafc; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 12px; padding: 32px 40px;
            box-shadow: 0 1px 3px rgba(0,0,0,.1); width: 100%; max-width: 380px;
            text-align: center; }
    h1 { margin: 0 0 24px; font-size: 24px; }
    .providers { text-align: left; }
    .provider-btn { display:flex;align-items:center;gap:8px;margin:8px 0;padding:12px 20px;
                    border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;color:#1a202c;
                    font-weight:500;background:white;transition:background 0.15s; }
    .provider-btn:hover { background: #f7fafc; }
  </style>
</head>
<body>
  <div class="card">
    ${logo}
    <h1>${brandName}</h1>
    <div class="providers">${providerLinks}</div>
  </div>
</body>
</html>`;
}

export function renderErrorPage(
  error: string,
  retryAfter: string | null,
  signInUrl: string,
  theme: Required<ThemeConfig>
): string {
  const brandName = theme.brandName !== 'Sign In' ? escapeHtml(theme.brandName) : undefined;

  const messages: Record<string, string> = {
    OAuthAccountNotLinked:
      'This email is already associated with another account. Enable account linking or sign in with your original provider.',
    OAuthCallbackError: 'Authentication failed. Please try again.',
    OAuthStateError: 'Authentication state mismatch. Please try again.',
    AccessDenied: 'You do not have permission to sign in.',
    RateLimitExceeded: `Too many sign-in attempts. Please wait${retryAfter ? ` ${retryAfter} seconds` : ''} before trying again.`,
    InvalidCredentials: 'Invalid email or password.',
    SessionExpired: 'Your session has expired. Please sign in again.',
    Configuration: 'Server configuration error.',
    Unknown: 'An unexpected error occurred.',
  };

  const message = messages[error] ?? messages.Unknown;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authentication Error${brandName ? ` — ${brandName}` : ''}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #f7fafc; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: white; border-radius: 12px; padding: 32px 40px;
            box-shadow: 0 1px 3px rgba(0,0,0,.1); width: 100%; max-width: 420px; text-align: center; }
    h1 { color: #e53e3e; margin-bottom: 12px; }
    p { color: #4a5568; line-height: 1.6; }
    a { display:inline-block; margin-top:20px; padding:10px 24px;
        background:${safeCssColor(theme.buttonColor || '#3182ce')}; color:white; border-radius:6px; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authentication Error</h1>
    <p>${message}</p>
    <a href="${signInUrl}">Try again</a>
  </div>
</body>
</html>`;
}
