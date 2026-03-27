import type { EmailProvider, EmailTransport } from '../types.js';

export interface ResendTransportConfig {
  apiKey: string;
  from?: string;
}

/**
 * ResendTransport — sends magic link emails via the Resend API.
 * Edge-compatible (pure fetch, no Node.js dependencies).
 *
 * @example
 * ```ts
 * import { EmailProvider, ResendTransport } from "vinextauth/providers/email"
 *
 * VinextAuth({
 *   providers: [
 *     EmailProvider({
 *       from: "no-reply@yourapp.com",
 *       transport: ResendTransport({ apiKey: env.RESEND_API_KEY }),
 *     }),
 *   ],
 * })
 * ```
 */
export function ResendTransport(options: ResendTransportConfig): EmailTransport {
  return {
    async sendVerificationRequest({ identifier, url, provider }) {
      const from = options.from ?? provider.from ?? 'noreply@example.com';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: identifier,
          subject: 'Sign in to your account',
          html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <p>Click the button below to sign in. This link expires in 24 hours.</p>
  <a href="${url}"
     style="display:inline-block;padding:12px 24px;background:#3182ce;color:#fff;
            text-decoration:none;border-radius:6px;font-weight:600">
    Sign in
  </a>
  <p style="margin-top:16px;font-size:12px;color:#718096">
    If you did not request this email, you can safely ignore it.
  </p>
</div>`,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`[VinextAuth] Resend error ${res.status}: ${body}`);
      }
    },
  };
}

export interface EmailProviderConfig {
  from?: string;
  /** Token TTL in seconds. Default: 86400 (24 h) */
  maxAge?: number;
  transport: EmailTransport;
  generateVerificationToken?: () => Promise<string>;
}

/**
 * Email (magic link) provider.
 *
 * Requires an adapter that implements `createVerificationToken` and
 * `useVerificationToken` (e.g. CloudflareKVAdapter or CloudflareD1Adapter).
 *
 * @example
 * ```ts
 * import { EmailProvider, ResendTransport } from "vinextauth/providers/email"
 *
 * VinextAuth({
 *   providers: [
 *     EmailProvider({
 *       from: "no-reply@yourapp.com",
 *       transport: ResendTransport({ apiKey: env.RESEND_API_KEY }),
 *     }),
 *   ],
 *   adapter: CloudflareKVAdapter(env.SESSION_KV),
 * })
 * ```
 */
export function EmailProvider(config: EmailProviderConfig): EmailProvider {
  return {
    id: 'email',
    name: 'Email',
    type: 'email',
    from: config.from,
    maxAge: config.maxAge ?? 24 * 60 * 60,
    transport: config.transport,
    generateVerificationToken: config.generateVerificationToken,
  };
}

export default EmailProvider;
