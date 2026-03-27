import { describe, it, expect, vi } from 'vitest';
import { handleEmailSignin } from '../email-signin.js';
import { resolveConfig } from '../../core/config.js';
import { generateCsrfToken } from '../../core/csrf.js';
import type { EmailProvider, AdapterInterface } from '../../types.js';

const TEST_SECRET = 'test-secret-32-chars-long-enough!!';
const BASE_URL = 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmailProvider(overrides: Partial<EmailProvider> = {}): EmailProvider {
  return {
    id: 'email',
    name: 'Email',
    type: 'email',
    maxAge: 3600,
    transport: {
      sendVerificationRequest: vi.fn(async () => {}),
    },
    ...overrides,
  };
}

function makeAdapter(overrides: Partial<AdapterInterface> = {}): AdapterInterface {
  const users: Array<{
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  }> = [];
  const vtokens: Array<{ identifier: string; token: string; expires: Date }> = [];

  return {
    getSession: async () => null,
    createSession: async (s) => s,
    updateSession: async () => null,
    deleteSession: async () => undefined,
    getUserByEmail: async (email) => users.find((u) => u.email === email) ?? null,
    createUser: async (user) => {
      const created = {
        id: `user-${Date.now()}`,
        name: user.name ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
      };
      users.push(created);
      return created;
    },
    createVerificationToken: async (vt) => {
      vtokens.push(vt);
      return vt;
    },
    useVerificationToken: async ({ identifier, token }) => {
      const idx = vtokens.findIndex((vt) => vt.identifier === identifier && vt.token === token);
      if (idx === -1) return null;
      return vtokens.splice(idx, 1)[0];
    },
    ...overrides,
  };
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return resolveConfig({
    secret: TEST_SECRET,
    baseUrl: BASE_URL,
    providers: [],
    adapter: makeAdapter(),
    ...overrides,
  });
}

async function makeRequest(
  body: Record<string, string>,
  options: { contentType?: string } = {}
): Promise<Request> {
  const { token, cookieValue } = await generateCsrfToken(TEST_SECRET);
  const config = makeConfig();
  const csrfCookieName = config.cookies.csrfToken.name;
  const contentType = options.contentType ?? 'application/x-www-form-urlencoded';
  const fullBody = { csrfToken: token, ...body };

  const reqBody =
    contentType === 'application/json'
      ? JSON.stringify(fullBody)
      : new URLSearchParams(fullBody).toString();

  return new Request(`${BASE_URL}/api/auth/signin/email`, {
    method: 'POST',
    headers: {
      'content-type': contentType,
      cookie: `${csrfCookieName}=${encodeURIComponent(cookieValue)}`,
    },
    body: reqBody,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleEmailSignin', () => {
  it('redirects to AccessDenied when CSRF is missing', async () => {
    const config = makeConfig();
    const provider = makeEmailProvider();
    const req = new Request(`${BASE_URL}/api/auth/signin/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'email=alice%40example.com',
    });
    const res = await handleEmailSignin(req, provider, config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('AccessDenied');
  });

  it('redirects to error when email is missing', async () => {
    const config = makeConfig();
    const provider = makeEmailProvider();
    const req = await makeRequest({ email: '' });
    const res = await handleEmailSignin(req, provider, config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('InvalidEmail');
  });

  it('redirects to error when email has no @', async () => {
    const config = makeConfig();
    const provider = makeEmailProvider();
    const req = await makeRequest({ email: 'notanemail' });
    const res = await handleEmailSignin(req, provider, config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('InvalidEmail');
  });

  it('throws when adapter lacks createVerificationToken', async () => {
    const config = resolveConfig({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [],
      adapter: {
        getSession: async () => null,
        createSession: async (s) => s,
        updateSession: async () => null,
        deleteSession: async () => undefined,
        // no createVerificationToken
      },
    });
    const provider = makeEmailProvider();
    const req = await makeRequest({ email: 'alice@example.com' });
    await expect(handleEmailSignin(req, provider, config)).rejects.toThrow(
      /createVerificationToken/
    );
  });

  it('sends magic link email and redirects to verify-request on success (form-urlencoded)', async () => {
    const sendMock = vi.fn(async () => {});
    const provider = makeEmailProvider({ transport: { sendVerificationRequest: sendMock } });
    const config = makeConfig();
    const req = await makeRequest({ email: 'alice@example.com' });
    const res = await handleEmailSignin(req, provider, config);

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('verify-request');
    expect(sendMock).toHaveBeenCalledOnce();

    const call = (sendMock.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
    expect(call.identifier).toBe('alice@example.com');
    expect(String(call.url)).toContain('/callback/email');
    expect(String(call.url)).toContain('token=');
  });

  it('sends magic link email via JSON body', async () => {
    const sendMock = vi.fn(async () => {});
    const provider = makeEmailProvider({ transport: { sendVerificationRequest: sendMock } });
    const config = makeConfig();
    const req = await makeRequest(
      { email: 'bob@example.com' },
      { contentType: 'application/json' }
    );
    const res = await handleEmailSignin(req, provider, config);
    expect(res.status).toBe(302);
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it('normalises email to lowercase', async () => {
    const sendMock = vi.fn(async () => {});
    const provider = makeEmailProvider({ transport: { sendVerificationRequest: sendMock } });
    const config = makeConfig();
    const req = await makeRequest({ email: 'Alice@Example.COM' });
    await handleEmailSignin(req, provider, config);
    const call = (sendMock.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
    expect(call.identifier).toBe('alice@example.com');
  });

  it('creates user when getUserByEmail returns null and createUser is available', async () => {
    const createdUsers: string[] = [];
    const adapter = makeAdapter({
      getUserByEmail: async () => null,
      createUser: async (user) => {
        createdUsers.push(user.email!);
        return { id: 'new-id', name: null, email: user.email ?? null, image: null };
      },
    });
    const config = resolveConfig({
      secret: TEST_SECRET,
      baseUrl: BASE_URL,
      providers: [],
      adapter,
    });
    const provider = makeEmailProvider();
    const req = await makeRequest({ email: 'new@example.com' });
    const res = await handleEmailSignin(req, provider, config);
    expect(res.status).toBe(302);
    expect(createdUsers).toContain('new@example.com');
  });

  it('uses generateVerificationToken from provider when provided', async () => {
    const customToken = 'custom-token-abc-123';
    const provider = makeEmailProvider({
      generateVerificationToken: async () => customToken,
    });
    const sendMock = vi.fn(async () => {});
    provider.transport = { sendVerificationRequest: sendMock };

    const config = makeConfig();
    const req = await makeRequest({ email: 'carol@example.com' });
    await handleEmailSignin(req, provider, config);

    const call = (sendMock.mock.calls as unknown[][])[0][0] as Record<string, unknown>;
    expect(String(call.url)).toContain(`token=${customToken}`);
  });

  it('redirects to EmailSendFailed when transport throws', async () => {
    const provider = makeEmailProvider({
      transport: {
        sendVerificationRequest: async () => {
          throw new Error('SMTP failed');
        },
      },
    });
    const config = makeConfig();
    const req = await makeRequest({ email: 'dave@example.com' });
    const res = await handleEmailSignin(req, provider, config);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('EmailSendFailed');
  });

  it('includes provider id in verify-request redirect URL', async () => {
    const provider = makeEmailProvider({ id: 'resend' });
    const config = makeConfig();
    const req = await makeRequest({ email: 'eve@example.com' });
    const res = await handleEmailSignin(req, provider, config);
    expect(res.headers.get('location')).toContain('provider=resend');
  });
});
