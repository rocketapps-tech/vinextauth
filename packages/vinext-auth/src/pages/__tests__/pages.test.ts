import { describe, it, expect } from 'vitest';
import { renderSignInPage, renderVerifyRequestPage, renderErrorPage } from '../index.js';
import type { SignInProvider } from '../index.js';

const DEFAULT_THEME = {
  brandName: 'Sign In',
  logoUrl: '',
  colorScheme: 'light' as const,
  buttonColor: '#3182ce',
};

// ─── renderSignInPage ─────────────────────────────────────────────────────────

describe('renderSignInPage', () => {
  it('returns valid HTML with DOCTYPE', () => {
    const html = renderSignInPage([], '/', DEFAULT_THEME);
    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('</html>');
  });

  it('renders an OAuth provider as a link', () => {
    const providers: SignInProvider[] = [
      {
        id: 'github',
        name: 'GitHub',
        type: 'oauth',
        signinUrl: '/api/auth/signin/github',
      },
    ];
    const html = renderSignInPage(providers, '/', DEFAULT_THEME);
    expect(html).toContain('Sign in with GitHub');
    expect(html).toContain('/api/auth/signin/github');
  });

  it('renders a credentials provider as a form with inputs', () => {
    const providers: SignInProvider[] = [
      {
        id: 'credentials',
        name: 'Password',
        type: 'credentials',
        signinUrl: '/api/auth/signin/credentials',
        csrfToken: 'csrf-abc',
      },
    ];
    const html = renderSignInPage(providers, '/', DEFAULT_THEME);
    expect(html).toContain('<form');
    expect(html).toContain('method="POST"');
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain('csrf-abc');
  });

  it('renders an email provider as a link (not a form)', () => {
    // The built-in sign-in page renders email providers as links — the actual
    // email input form is handled by the /signin/email POST endpoint.
    const providers: SignInProvider[] = [
      {
        id: 'email',
        name: 'Email',
        type: 'email',
        signinUrl: '/api/auth/signin/email',
        csrfToken: 'csrf-xyz',
      },
    ];
    const html = renderSignInPage(providers, '/', DEFAULT_THEME);
    expect(html).toContain('Sign in with Email');
    expect(html).toContain('/api/auth/signin/email');
  });

  it('renders custom brand name', () => {
    const html = renderSignInPage([], '/', { ...DEFAULT_THEME, brandName: 'MyApp' });
    expect(html).toContain('MyApp');
  });

  it('renders logo image when logoUrl is a valid https URL', () => {
    const html = renderSignInPage([], '/', {
      ...DEFAULT_THEME,
      logoUrl: 'https://example.com/logo.png',
    });
    expect(html).toContain('<img');
    expect(html).toContain('https://example.com/logo.png');
  });

  it('omits logo when logoUrl is empty', () => {
    const html = renderSignInPage([], '/', { ...DEFAULT_THEME, logoUrl: '' });
    expect(html).not.toContain('<img');
  });

  it('omits logo for unsafe URLs (not https or data:)', () => {
    const html = renderSignInPage([], '/', { ...DEFAULT_THEME, logoUrl: 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<img');
  });

  it('escapes HTML in brand name', () => {
    const html = renderSignInPage([], '/', {
      ...DEFAULT_THEME,
      brandName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes provider name to prevent XSS', () => {
    const providers: SignInProvider[] = [
      {
        id: 'evil',
        name: '<img src=x onerror=alert(1)>',
        type: 'oauth',
        signinUrl: '/api/auth/signin/evil',
      },
    ];
    const html = renderSignInPage(providers, '/', DEFAULT_THEME);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('includes callbackUrl in OAuth provider link', () => {
    const providers: SignInProvider[] = [
      {
        id: 'google',
        name: 'Google',
        type: 'oauth',
        signinUrl: '/api/auth/signin/google',
      },
    ];
    const callbackUrl = '/dashboard';
    const html = renderSignInPage(providers, callbackUrl, DEFAULT_THEME);
    expect(html).toContain(encodeURIComponent(callbackUrl));
  });
});

// ─── renderVerifyRequestPage ──────────────────────────────────────────────────

describe('renderVerifyRequestPage', () => {
  it('returns valid HTML with DOCTYPE', () => {
    const html = renderVerifyRequestPage('email', DEFAULT_THEME);
    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('</html>');
  });

  it('includes the provider name', () => {
    const html = renderVerifyRequestPage('Resend', DEFAULT_THEME);
    expect(html).toContain('Resend');
  });

  it('includes "Check your email" heading', () => {
    const html = renderVerifyRequestPage('email', DEFAULT_THEME);
    expect(html).toContain('Check your email');
  });

  it('escapes provider name to prevent XSS', () => {
    const html = renderVerifyRequestPage('<script>alert(1)</script>', DEFAULT_THEME);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes brand name in title', () => {
    const html = renderVerifyRequestPage('email', { ...DEFAULT_THEME, brandName: 'MyApp' });
    expect(html).toContain('MyApp');
  });
});

// ─── renderErrorPage ──────────────────────────────────────────────────────────

describe('renderErrorPage', () => {
  it('returns valid HTML with DOCTYPE', () => {
    const html = renderErrorPage('AccessDenied', null, '/api/auth/signin', DEFAULT_THEME);
    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('</html>');
  });

  it('renders the AccessDenied message', () => {
    const html = renderErrorPage('AccessDenied', null, '/api/auth/signin', DEFAULT_THEME);
    expect(html).toContain('do not have permission');
  });

  it('renders the OAuthAccountNotLinked message', () => {
    const html = renderErrorPage('OAuthAccountNotLinked', null, '/api/auth/signin', DEFAULT_THEME);
    expect(html).toContain('already associated');
  });

  it('renders the OAuthCallbackError message', () => {
    const html = renderErrorPage('OAuthCallbackError', null, '/api/auth/signin', DEFAULT_THEME);
    expect(html).toContain('Authentication failed');
  });

  it('renders the OAuthStateError message', () => {
    const html = renderErrorPage('OAuthStateError', null, '/api/auth/signin', DEFAULT_THEME);
    expect(html).toContain('state mismatch');
  });

  it('renders the RateLimitExceeded message with retryAfter', () => {
    const html = renderErrorPage('RateLimitExceeded', '30', '/api/auth/signin', DEFAULT_THEME);
    expect(html).toContain('Too many');
    expect(html).toContain('30 seconds');
  });

  it('renders the RateLimitExceeded message without retryAfter', () => {
    const html = renderErrorPage('RateLimitExceeded', null, '/api/auth/signin', DEFAULT_THEME);
    expect(html).toContain('Too many');
    expect(html).not.toContain('null');
  });

  it('renders the InvalidCredentials message', () => {
    const html = renderErrorPage('InvalidCredentials', null, '/api/auth/signin', DEFAULT_THEME);
    expect(html).toContain('Invalid email or password');
  });

  it('renders the Configuration error message', () => {
    const html = renderErrorPage('Configuration', null, '/api/auth/signin', DEFAULT_THEME);
    expect(html).toContain('configuration error');
  });

  it('renders the SessionExpired message', () => {
    const html = renderErrorPage('SessionExpired', null, '/api/auth/signin', DEFAULT_THEME);
    expect(html).toContain('session has expired');
  });

  it('renders Unknown error for unrecognised error code', () => {
    const html = renderErrorPage('SomethingRandom', null, '/api/auth/signin', DEFAULT_THEME);
    expect(html).toContain('unexpected error');
  });

  it('includes a link back to sign-in', () => {
    const html = renderErrorPage('AccessDenied', null, '/login', DEFAULT_THEME);
    expect(html).toContain('href="/login"');
  });

  it('renders custom brand name in title', () => {
    const html = renderErrorPage('AccessDenied', null, '/api/auth/signin', {
      ...DEFAULT_THEME,
      brandName: 'MyApp',
    });
    expect(html).toContain('MyApp');
  });

  it('does not show brand name in title when brandName is the default "Sign In"', () => {
    const html = renderErrorPage('AccessDenied', null, '/api/auth/signin', DEFAULT_THEME);
    // The page title should just be "Authentication Error" without " — Sign In"
    expect(html).toContain('<title>Authentication Error</title>');
  });

  it('uses safe CSS color for button', () => {
    const html = renderErrorPage('AccessDenied', null, '/api/auth/signin', {
      ...DEFAULT_THEME,
      buttonColor: '#ff0000',
    });
    expect(html).toContain('#ff0000');
  });

  it('falls back to default button color for unsafe CSS values', () => {
    const html = renderErrorPage('AccessDenied', null, '/api/auth/signin', {
      ...DEFAULT_THEME,
      buttonColor: 'expression(alert(1))',
    });
    expect(html).toContain('#3182ce'); // fallback
    expect(html).not.toContain('expression(');
  });
});
