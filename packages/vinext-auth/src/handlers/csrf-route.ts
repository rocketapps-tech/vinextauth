import type { ResolvedConfig } from '../types.js';
import { getCsrfCookie, applyCsrfCookie } from '../cookies/index.js';
import { generateCsrfToken } from '../core/csrf.js';

export async function handleCsrfRoute(request: Request, config: ResolvedConfig): Promise<Response> {
  // Reuse existing CSRF cookie if present and valid
  const existing = getCsrfCookie(request, config);
  if (existing) {
    const token = existing.split('|')[0];
    return Response.json({ csrfToken: token });
  }

  const { token, cookieValue } = await generateCsrfToken(config.secret);
  const headers = new Headers();
  applyCsrfCookie(headers, cookieValue, config);

  return Response.json({ csrfToken: token }, { headers });
}
