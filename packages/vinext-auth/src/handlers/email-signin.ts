import type { ResolvedConfig, EmailProvider } from '../types.js';
import { verifyCsrfToken } from '../core/csrf.js';
import { getCsrfCookie } from '../cookies/index.js';
import { resolveBaseUrl } from '../core/config.js';

function generateId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * POST /api/auth/signin/email
 *
 * Flow:
 * 1. Validate CSRF token
 * 2. Extract and normalise email from body
 * 3. Check adapter.getUserByEmail() — create user if not found (and createUser is available)
 * 4. Generate a secure verification token
 * 5. Store token via adapter.createVerificationToken()
 * 6. Build the magic link URL
 * 7. Call provider.transport.sendVerificationRequest()
 * 8. Redirect to /api/auth/verify-request
 */
export async function handleEmailSignin(
  request: Request,
  provider: EmailProvider,
  config: ResolvedConfig
): Promise<Response> {
  const baseUrl = await resolveBaseUrl(config, request);
  const errorBase = `${baseUrl}${config.pages.error}`;

  // ── CSRF validation ───────────────────────────────────────────────────────
  const cookieValue = getCsrfCookie(request, config);
  let bodyEmail = '';
  let csrfTokenFromBody = '';

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    bodyEmail = typeof body.email === 'string' ? body.email : '';
    csrfTokenFromBody = typeof body.csrfToken === 'string' ? body.csrfToken : '';
  } else {
    const body = await request.formData().catch(() => new FormData());
    bodyEmail = body.get('email')?.toString() ?? '';
    csrfTokenFromBody = body.get('csrfToken')?.toString() ?? '';
  }

  const csrfValid = cookieValue
    ? await verifyCsrfToken(csrfTokenFromBody, cookieValue, config.secret)
    : false;

  if (!csrfValid) {
    return Response.redirect(`${errorBase}?error=AccessDenied`, 302);
  }

  // ── Validate email ────────────────────────────────────────────────────────
  const email = bodyEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return Response.redirect(`${errorBase}?error=Configuration&hint=InvalidEmail`, 302);
  }

  // ── Require adapter with verification token support ───────────────────────
  if (!config.adapter?.createVerificationToken) {
    throw new Error(
      '[VinextAuth] EmailProvider requires an adapter with createVerificationToken support.'
    );
  }

  // ── Resolve or create user ────────────────────────────────────────────────
  if (config.adapter.getUserByEmail) {
    const existing = await config.adapter.getUserByEmail(email);
    if (!existing && config.adapter.createUser) {
      await config.adapter.createUser({ name: null, email, image: null });
    }
  }

  // ── Generate verification token ───────────────────────────────────────────
  const rawToken = provider.generateVerificationToken
    ? await provider.generateVerificationToken()
    : generateId();

  const maxAge = provider.maxAge ?? 24 * 60 * 60;
  const expires = new Date(Date.now() + maxAge * 1000);

  await config.adapter.createVerificationToken({ identifier: email, token: rawToken, expires });

  // ── Build magic link ──────────────────────────────────────────────────────
  const callbackUrl = new URL(`${baseUrl}${config.basePath}/callback/email`);
  callbackUrl.searchParams.set('token', rawToken);
  callbackUrl.searchParams.set('email', email);

  // ── Send email ────────────────────────────────────────────────────────────
  try {
    await provider.transport.sendVerificationRequest({
      identifier: email,
      url: callbackUrl.toString(),
      expires,
      provider,
      request,
    });
  } catch (err) {
    if (config.debug) console.error('[VinextAuth] Email send error:', err);
    return Response.redirect(`${errorBase}?error=Configuration&hint=EmailSendFailed`, 302);
  }

  // ── Redirect to verify-request page ──────────────────────────────────────
  const verifyUrl = new URL(`${baseUrl}${config.pages.verifyRequest}`);
  verifyUrl.searchParams.set('provider', provider.id);
  return Response.redirect(verifyUrl.toString(), 302);
}
