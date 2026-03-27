# VinextAuth — Roadmap de Implementação

Este documento registra o trabalho planejado para trazer o VinextAuth à paridade completa com o NextAuth v4 e além. Os itens estão ordenados por prioridade.

---

## Resumo

| # | Feature | Prioridade | Complexidade | Status |
|---|---------|------------|--------------|--------|
| 1 | [Providers OAuth](#1-providers-oauth) | Alta | Baixa | ✅ Concluído |
| 2 | [Provider Email / Magic Link](#2-provider-email--magic-link) | Alta | Alta | ✅ Concluído |
| 3 | [Sistema de Eventos](#3-sistema-de-eventos) | Média | Baixa | ⬜ Pendente |
| 4 | [Rate Limiter Distribuído — Cloudflare KV](#4-rate-limiter-distribuído--cloudflare-kv) | Média | Baixa | ⬜ Pendente |
| 5 | [Adapter Cloudflare D1](#5-adapter-cloudflare-d1) | Média | Média | ⬜ Pendente |
| 6 | [Expansão de Cobertura de Testes](#6-expansão-de-cobertura-de-testes) | Média | Média | ⬜ Pendente |

---

## 1. Providers OAuth

**Prioridade: Alta — Complexidade: Baixa**

O VinextAuth atualmente vem com Google e GitHub. O padrão já está estabelecido — cada provider é uma função pura que retorna um objeto `OAuthProvider`. Adicionar novos providers é trabalho mecânico sem mudanças arquiteturais.

### Providers a implementar

| Provider | Arquivo | Versão OAuth | Notas |
|----------|---------|--------------|-------|
| Discord | `src/providers/discord.ts` | OAuth2 | escopo `identify email` |
| Microsoft / Azure AD | `src/providers/microsoft.ts` | OAuth2 | tenant-aware, `openid email profile` |
| Apple | `src/providers/apple.ts` | OAuth2 | **complexo** — exige JWT como client_secret assinado com ES256 |
| Twitter / X | `src/providers/twitter.ts` | OAuth2 + PKCE | usar `checks: ['pkce', 'state']` |
| Facebook | `src/providers/facebook.ts` | OAuth2 | userinfo via Graph API |
| LinkedIn | `src/providers/linkedin.ts` | OAuth2 | |
| Twitch | `src/providers/twitch.ts` | OAuth2 | |
| Spotify | `src/providers/spotify.ts` | OAuth2 | |

### Template de implementação

Todo provider segue o mesmo contrato. Copie `src/providers/github.ts` e ajuste os endpoints e o mapeamento de perfil:

```ts
// src/providers/discord.ts
import type { OAuthProvider, User } from '../types.js';

export interface DiscordProviderConfig {
  clientId: string;
  clientSecret: string;
  authorization?: { params?: Record<string, string> };
}

export function DiscordProvider(config: DiscordProviderConfig): OAuthProvider {
  return {
    id: 'discord',
    name: 'Discord',
    type: 'oauth',
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorization: {
      url: 'https://discord.com/api/oauth2/authorize',
      params: {
        response_type: 'code',
        scope: 'identify email',
        ...config.authorization?.params,
      },
    },
    token: { url: 'https://discord.com/api/oauth2/token' },
    userinfo: { url: 'https://discord.com/api/users/@me' },
    profile(profile): User {
      return {
        id: profile.id as string,
        name: profile.username as string | null,
        email: profile.email as string | null,
        image: profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : null,
      };
    },
    checks: ['state'],
  };
}

export default DiscordProvider;
```

### Apple — tratamento especial

O Apple exige um JWT de vida curta como `client_secret` (ES256, assinado com uma chave privada `.p8`). É o único provider que não pode usar uma string estática como secret.

A interface `OAuthProvider` precisa de um escape hatch `clientSecretFactory`:

```ts
// Adição proposta ao OAuthProvider em types.ts
export interface OAuthProvider {
  // ...campos existentes
  /**
   * Opcional: gera o client_secret dinamicamente por requisição.
   * Necessário para Apple (JWT assinado com ES256 a cada chamada).
   */
  clientSecretFactory?: () => Promise<string>;
}
```

Shape de configuração do Apple:
```ts
export interface AppleProviderConfig {
  clientId: string;       // Services ID (com.suaapp.signin)
  teamId: string;         // Team ID de 10 caracteres
  keyId: string;          // Key ID do Apple Developer
  privateKey: string;     // Conteúdo PEM do arquivo .p8
}
```

O factory assina um JWT usando Web Crypto `ECDSA` com a curva P-256 — compatível com edge runtime.

### Checklist por provider

Após criar o arquivo:

1. Adicionar export nomeado em `src/index.ts`
2. Adicionar entrada em `tsup.config.ts` sob `entry`:
   ```ts
   'providers/discord': 'src/providers/discord.ts',
   ```
3. Adicionar export em `package.json#exports`:
   ```json
   "./providers/discord": {
     "import": "./dist/providers/discord.js",
     "types": "./dist/providers/discord.d.ts"
   }
   ```

---

## 2. Provider Email / Magic Link

**Prioridade: Alta — Complexidade: Alta**

É o gap mais impactante. Muitos apps usam autenticação passwordless por email. A implementação exige:

1. Um novo tipo `EmailProvider`
2. Um modelo `VerificationToken` na interface do adapter
3. Um novo handler: `handleEmailSignin`
4. Um novo handler: `handleEmailVerify` (o endpoint do clique no link)
5. Uma interface `EmailTransport` para envio de emails

### Novos tipos em `types.ts`

```ts
// ─── Email Provider ───────────────────────────────────────────────────────────

export interface EmailTransport {
  /**
   * Envia o email de sign-in com o magic link.
   * Use qualquer API HTTP compatível com edge (Resend, SendGrid, Mailgun, etc.)
   */
  sendVerificationRequest(params: {
    identifier: string;   // endereço de email
    url: string;          // a URL do magic link
    expires: Date;
    provider: EmailProvider;
    request: Request;
  }): Promise<void>;
}

export interface EmailProvider {
  id: string;
  name: string;
  type: 'email';
  from?: string;
  maxAge?: number;          // TTL do token em segundos, padrão 24h
  transport: EmailTransport;
  generateVerificationToken?: () => Promise<string>;
}

// ─── Adapter — Tokens de verificação ─────────────────────────────────────────

export interface VerificationToken {
  identifier: string;  // email
  token: string;
  expires: Date;
}

// Adicionar ao AdapterInterface:
export interface AdapterInterface {
  // ...métodos existentes
  createVerificationToken?(token: VerificationToken): Promise<VerificationToken>;
  useVerificationToken?(params: {
    identifier: string;
    token: string;
  }): Promise<VerificationToken | null>;
  getUserByEmail?(email: string): Promise<DefaultUser | null>;
  createUser?(user: Omit<DefaultUser, 'id'>): Promise<DefaultUser>;
}
```

### Novo handler: `src/handlers/email-signin.ts`

Fluxo: `POST /api/auth/signin/email`

```
1. Validar o token CSRF
2. Extrair o email do body
3. Verificar adapter.getUserByEmail() — criar se não existir (ou falhar se allowNewUsers = false)
4. Gerar um token de verificação seguro (crypto.getRandomValues)
5. Armazenar o token via adapter.createVerificationToken()
6. Construir o magic link: {baseUrl}/api/auth/callback/email?token=...&email=...
7. Chamar provider.transport.sendVerificationRequest()
8. Redirecionar para /api/auth/verify-request
```

### Novo handler: `src/handlers/email-verify.ts`

Fluxo: `GET /api/auth/callback/email?token=...&email=...`

```
1. Extrair token + email dos query params
2. Chamar adapter.useVerificationToken() — retorna o token se válido, null se expirado/já usado
3. Se null → redirecionar para /api/auth/error?error=Verification
4. Buscar usuário por email via adapter.getUserByEmail()
5. Executar callback signIn
6. Criar sessão (JWT ou database conforme a strategy)
7. Setar o cookie de sessão
8. Redirecionar para callbackUrl
```

### Email transport — exemplo com Resend

```ts
// src/providers/email.ts

import type { EmailProvider, EmailTransport } from '../types.js';

export function ResendTransport(options: { apiKey: string; from?: string }): EmailTransport {
  return {
    async sendVerificationRequest({ identifier, url, provider }) {
      const from = options.from ?? provider.from ?? 'noreply@example.com';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: identifier,
          subject: 'Entre na sua conta',
          html: `<p>Clique <a href="${url}">aqui</a> para entrar. Este link expira em 24 horas.</p>`,
        }),
      });
      if (!res.ok) throw new Error(`[VinextAuth] Resend error: ${res.status}`);
    },
  };
}

export function EmailProvider(config: {
  from?: string;
  maxAge?: number;
  transport: EmailTransport;
}): import('../types.js').EmailProvider {
  return {
    id: 'email',
    name: 'Email',
    type: 'email',
    from: config.from,
    maxAge: config.maxAge ?? 24 * 60 * 60,
    transport: config.transport,
  };
}
```

### Mudanças necessárias no codebase

| Arquivo | Mudança |
|---------|---------|
| `src/types.ts` | Adicionar `EmailProvider`, `EmailTransport`, `VerificationToken`; estender `AdapterInterface` |
| `src/handlers/index.ts` | Adicionar roteamento para `POST signin/email` e `GET callback/email` |
| `src/handlers/email-signin.ts` | Novo arquivo — geração do magic link + disparo do email |
| `src/handlers/email-verify.ts` | Novo arquivo — verificação do link + criação de sessão |
| `src/providers/email.ts` | Factory `EmailProvider()` + helper `ResendTransport()` |
| `src/adapters/cloudflare-kv.ts` | Implementar `createVerificationToken`, `useVerificationToken`, `getUserByEmail`, `createUser` |
| `src/pages/index.ts` | Adicionar página "Verifique seu email" (`renderVerifyRequestPage`) |
| `tsup.config.ts` | Adicionar entrada `providers/email` |
| `package.json` | Adicionar export `./providers/email` |

---

## 3. Sistema de Eventos

**Prioridade: Média — Complexidade: Baixa**

O NextAuth dispara eventos de ciclo de vida que os apps usam para audit log, analytics, emails de boas-vindas e provisionamento de usuários. O VinextAuth não tem eventos hoje.

### Novos tipos em `types.ts`

```ts
// ─── Events ───────────────────────────────────────────────────────────────────

export interface EventsConfig<TUser = {}> {
  /**
   * Dispara quando um usuário faz sign-in.
   * `isNewUser` é true no primeiro acesso (OAuth apenas, requer adapter).
   */
  signIn?: (params: {
    user: User<TUser>;
    account: SignInCallbackParams['account'];
    isNewUser?: boolean;
  }) => void | Promise<void>;

  /**
   * Dispara quando um usuário faz sign-out.
   */
  signOut?: (params: { token: DefaultJWT | null }) => void | Promise<void>;

  /**
   * Dispara quando um novo registro de usuário é criado.
   * Chamado apenas quando há um adapter e o usuário é criado pela primeira vez.
   */
  createUser?: (params: { user: User<TUser> }) => void | Promise<void>;

  /**
   * Dispara quando um registro de usuário é atualizado (ex: refresh de perfil via OAuth).
   */
  updateUser?: (params: { user: User<TUser> }) => void | Promise<void>;

  /**
   * Dispara a cada verificação de sessão (GET /api/auth/session).
   * Não execute trabalho pesado aqui.
   */
  session?: (params: { session: DefaultSession; token: DefaultJWT }) => void | Promise<void>;
}
```

### Adicionar ao `VinextAuthConfig`

```ts
export interface VinextAuthConfig<TSession = {}, TToken = {}, TUser = {}> {
  // ...campos existentes
  events?: EventsConfig<TUser>;
}
```

### Adicionar ao `ResolvedConfig`

```ts
export interface ResolvedConfig {
  // ...campos existentes
  events: EventsConfig;
}
```

### Conectar aos handlers

Eventos são fire-and-forget. **Nunca** devem bloquear a resposta.

Padrão a usar nos handlers:

```ts
// Em callback.ts, após a sessão ser criada:
void config.events.signIn?.({ user, account, isNewUser });

// Em signout.ts, após o cookie ser limpo:
void config.events.signOut?.({ token: jwt });

// Em session-route.ts, após a sessão ser lida:
void config.events.session?.({ session, token: jwt });
```

### Mudanças necessárias

| Arquivo | Mudança |
|---------|---------|
| `src/types.ts` | Adicionar interface `EventsConfig`; adicionar `events?` em `VinextAuthConfig` e `ResolvedConfig` |
| `src/core/config.ts` | Adicionar `events: config.events ?? {}` em `resolveConfig()` |
| `src/handlers/callback.ts` | Disparar eventos `signIn` e `createUser` |
| `src/handlers/signout.ts` | Disparar evento `signOut` |
| `src/handlers/session-route.ts` | Disparar evento `session` |
| `src/handlers/credentials.ts` | Disparar evento `signIn` |

---

## 4. Rate Limiter Distribuído — Cloudflare KV

**Prioridade: Média — Complexidade: Baixa**

O `InMemoryRateLimiter` integrado não persiste entre instâncias de Worker do Cloudflare (cada requisição pode cair em um isolate diferente). A interface `RateLimiter` em `types.ts` já suporta stores customizados — este item adiciona uma implementação `CloudflareKVRateLimiter` de primeira parte.

### Novo arquivo: `src/adapters/cloudflare-kv-rate-limiter.ts`

```ts
import type { RateLimiter } from '../types.js';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface AttemptRecord {
  count: number;
  resetAt: number;
}

/**
 * Rate limiter com Cloudflare KV — persiste entre isolates de Worker.
 *
 * Uso:
 * ```ts
 * import { CloudflareKVRateLimiter } from "vinextauth/adapters/cloudflare-kv-rate-limiter"
 *
 * VinextAuth({
 *   credentials: {
 *     rateLimit: {
 *       store: CloudflareKVRateLimiter(env.RATE_LIMIT_KV),
 *     },
 *   },
 * })
 * ```
 */
export function CloudflareKVRateLimiter(
  namespace: KVNamespace,
  options: { maxAttempts?: number; windowMs?: number } = {}
): RateLimiter {
  const maxAttempts = options.maxAttempts ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;

  function key(identifier: string): string {
    return `ratelimit:${identifier}`;
  }

  return {
    async check(identifier) {
      const now = Date.now();
      const raw = await namespace.get(key(identifier));
      const record: AttemptRecord = raw ? JSON.parse(raw) : { count: 0, resetAt: now + windowMs };

      if (now > record.resetAt) {
        const fresh: AttemptRecord = { count: 1, resetAt: now + windowMs };
        const ttl = Math.ceil(windowMs / 1000);
        await namespace.put(key(identifier), JSON.stringify(fresh), { expirationTtl: ttl });
        return { allowed: true };
      }

      if (record.count >= maxAttempts) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return { allowed: false, retryAfter };
      }

      record.count++;
      const ttl = Math.ceil((record.resetAt - now) / 1000);
      await namespace.put(key(identifier), JSON.stringify(record), { expirationTtl: ttl });
      return { allowed: true };
    },

    async reset(identifier) {
      await namespace.delete(key(identifier));
    },
  };
}
```

### Mudanças necessárias

| Arquivo | Mudança |
|---------|---------|
| `src/adapters/cloudflare-kv-rate-limiter.ts` | Novo arquivo (acima) |
| `tsup.config.ts` | Adicionar `'adapters/cloudflare-kv-rate-limiter': 'src/adapters/cloudflare-kv-rate-limiter.ts'` |
| `package.json` | Adicionar export `"./adapters/cloudflare-kv-rate-limiter"` |

Sem mudanças em `types.ts`, `config.ts` ou qualquer handler — a interface `RateLimiter` já suporta isso.

---

## 5. Adapter Cloudflare D1

**Prioridade: Média — Complexidade: Média**

O Cloudflare D1 (SQLite) é o banco de dados natural para Cloudflare Workers. Suporta a strategy `database` e a interface completa do adapter incluindo tokens de verificação (necessário para o provider de Email).

### Schema

```sql
-- migrations/0001_vinextauth.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  email_verified INTEGER,   -- Unix timestamp
  image TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL  -- Unix timestamp
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires INTEGER NOT NULL, -- Unix timestamp
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  UNIQUE(provider, provider_account_id)
);
```

### Novo arquivo: `src/adapters/cloudflare-d1.ts`

```ts
import type { AdapterInterface, AdapterSession, DefaultUser, VerificationToken } from '../types.js';

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

/**
 * CloudflareD1Adapter — armazena usuários, sessões e tokens de verificação no D1.
 * Suporta todos os métodos do AdapterInterface incluindo magic links de email.
 *
 * Uso:
 * ```ts
 * import { CloudflareD1Adapter } from "vinextauth/adapters/cloudflare-d1"
 *
 * VinextAuth({
 *   adapter: CloudflareD1Adapter(env.DB),
 *   session: { strategy: "database" },
 * })
 * ```
 */
export function CloudflareD1Adapter(db: D1Database): AdapterInterface {
  return {
    async getSession(sessionToken) {
      const row = await db
        .prepare(
          `SELECT s.session_token, s.user_id, s.expires,
                  u.id, u.name, u.email, u.image
           FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.session_token = ?`
        )
        .bind(sessionToken)
        .first<{
          session_token: string;
          user_id: string;
          expires: number;
          id: string;
          name: string | null;
          email: string | null;
          image: string | null;
        }>();

      if (!row) return null;

      return {
        sessionToken: row.session_token,
        userId: row.user_id,
        expires: new Date(row.expires * 1000),
        user: { id: row.id, name: row.name, email: row.email, image: row.image },
      };
    },

    async createSession(session) {
      const expires = Math.floor(session.expires.getTime() / 1000);
      await db
        .prepare(`INSERT INTO sessions (session_token, user_id, expires) VALUES (?, ?, ?)`)
        .bind(session.sessionToken, session.userId, expires)
        .run();
      return session;
    },

    async updateSession(session) {
      const expires = session.expires ? Math.floor(session.expires.getTime() / 1000) : null;
      if (expires !== null) {
        await db
          .prepare(`UPDATE sessions SET expires = ? WHERE session_token = ?`)
          .bind(expires, session.sessionToken)
          .run();
      }
      return { sessionToken: session.sessionToken, userId: '', expires: session.expires! };
    },

    async deleteSession(sessionToken) {
      await db
        .prepare(`DELETE FROM sessions WHERE session_token = ?`)
        .bind(sessionToken)
        .run();
    },

    async getUserByEmail(email) {
      const row = await db
        .prepare(`SELECT id, name, email, image FROM users WHERE email = ?`)
        .bind(email)
        .first<DefaultUser>();
      return row ?? null;
    },

    async createUser(user) {
      const id = generateId();
      await db
        .prepare(`INSERT INTO users (id, name, email, image) VALUES (?, ?, ?, ?)`)
        .bind(id, user.name ?? null, user.email ?? null, user.image ?? null)
        .run();
      return { ...user, id };
    },

    async linkAccount(userId, provider, providerAccountId) {
      const id = generateId();
      await db
        .prepare(
          `INSERT OR IGNORE INTO accounts (id, user_id, provider, provider_account_id) VALUES (?, ?, ?, ?)`
        )
        .bind(id, userId, provider, providerAccountId)
        .run();
    },

    async getAccountByProvider(provider, providerAccountId) {
      const row = await db
        .prepare(
          `SELECT user_id FROM accounts WHERE provider = ? AND provider_account_id = ?`
        )
        .bind(provider, providerAccountId)
        .first<{ user_id: string }>();
      return row ? { userId: row.user_id } : null;
    },

    async createVerificationToken(verificationToken) {
      const expires = Math.floor(verificationToken.expires.getTime() / 1000);
      await db
        .prepare(
          `INSERT INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)`
        )
        .bind(verificationToken.identifier, verificationToken.token, expires)
        .run();
      return verificationToken;
    },

    async useVerificationToken({ identifier, token }) {
      const row = await db
        .prepare(
          `SELECT identifier, token, expires FROM verification_tokens WHERE identifier = ? AND token = ?`
        )
        .bind(identifier, token)
        .first<{ identifier: string; token: string; expires: number }>();

      if (!row) return null;

      await db
        .prepare(`DELETE FROM verification_tokens WHERE identifier = ? AND token = ?`)
        .bind(identifier, token)
        .run();

      return {
        identifier: row.identifier,
        token: row.token,
        expires: new Date(row.expires * 1000),
      };
    },
  };
}

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Mudanças necessárias

| Arquivo | Mudança |
|---------|---------|
| `src/adapters/cloudflare-d1.ts` | Novo arquivo (acima) |
| `src/types.ts` | Adicionar `createUser`, `createVerificationToken`, `useVerificationToken` ao `AdapterInterface` |
| `tsup.config.ts` | Adicionar `'adapters/cloudflare-d1': 'src/adapters/cloudflare-d1.ts'` |
| `package.json` | Adicionar export `"./adapters/cloudflare-d1"` |

---

## 6. Expansão de Cobertura de Testes

**Prioridade: Média — Complexidade: Média**

A suite atual cobre apenas o bridge do Pages Router (`src/handlers/__tests__/pages-router.test.ts`). Caminhos críticos estão sem testes.

### Arquivos de teste faltando

```
src/
├── jwt/__tests__/
│   └── jwt.test.ts              # encode/decode, expiração, detecção de adulteração
├── core/__tests__/
│   ├── csrf.test.ts             # geração de token, verificação, timing attack
│   ├── rate-limiter.test.ts     # reset de janela, max tentativas, extração de IP
│   ├── session.test.ts          # buildJWT, buildSession, refreshTokenIfNeeded
│   └── config.test.ts           # defaults e overrides do resolveConfig
├── providers/__tests__/
│   └── oauth-flow.test.ts       # validação de state, mapeamento de perfil, casos de erro
├── handlers/__tests__/
│   ├── callback.test.ts         # OAuth callback, state inválido, code ausente
│   ├── credentials.test.ts      # login válido, senha errada, rate limit atingido
│   ├── signout.test.ts          # cookie limpo, redirect
│   └── session-route.test.ts   # token válido, token expirado, sem token
├── middleware/__tests__/
│   └── with-auth.test.ts        # autorizado, não autorizado, callback customizado
└── adapters/__tests__/
    └── cloudflare-kv.test.ts    # getSession, createSession, sessão expirada
```

### O que cada suite deve cobrir

**`jwt.test.ts`**
```ts
it('faz roundtrip de um token: sign → verify')
it('retorna null para token expirado')
it('retorna null quando a assinatura é adulterada')
it('rejeita token assinado com secret diferente')
```

**`csrf.test.ts`**
```ts
it('generateCsrfToken retorna token + cookieValue com HMAC')
it('verifyCsrfToken aceita par válido de cookie + token')
it('verifyCsrfToken rejeita token incompatível')
it('verifyCsrfToken rejeita HMAC adulterado')
```

**`rate-limiter.test.ts`**
```ts
it('permite até maxAttempts dentro da janela')
it('bloqueia em maxAttempts + 1 e retorna retryAfter')
it('reseta após a janela expirar')
it('reset() limpa o contador')
it('getClientIp() prefere cf-connecting-ip sobre x-forwarded-for')
```

**`callback.test.ts`**
```ts
it('troca o code por token e cria o cookie de sessão')
it('redireciona para a página de erro quando state está ausente')
it('redireciona para a página de erro quando state é inválido')
it('redireciona para a página de erro quando a troca de token falha')
it('executa o callback signIn e bloqueia o acesso quando retorna false')
```

**`credentials.test.ts`**
```ts
it('faz sign-in com credentials válidas e seta o cookie de sessão')
it('retorna 401 quando authorize() retorna null')
it('retorna 429 quando o rate limit é atingido')
it('rejeita token CSRF ausente')
it('rejeita token CSRF inválido')
```

**`with-auth.test.ts`**
```ts
it('passa requisições com token de sessão válido')
it('redireciona para sign-in quando o token está ausente')
it('redireciona para sign-in quando o token está expirado')
it('chama o callback authorized() e respeita seu retorno')
it('passa para o middleware interno quando autorizado')
```

### Observação sobre o Vitest

Os testes já usam globals do `vitest`. Para Web Crypto nos testes, garantir que `vitest.config.ts` tenha:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',   // Web Crypto disponível no Node 18+
    globals: true,
  },
});
```

---

## Concluído

_(Os itens são movidos aqui após o merge)_

- ✅ Sessões JWT com HMAC-SHA256 (Web Crypto)
- ✅ Fluxo OAuth2 — Google, GitHub
- ✅ Provider Credentials com rate limiting integrado
- ✅ Proteção CSRF (double-submit cookie)
- ✅ Correção da race condition no refresh de token (mutex lock)
- ✅ `updateSession()` no servidor
- ✅ `baseUrl` multi-tenant como função assíncrona
- ✅ Adapter de sessão Cloudflare KV
- ✅ React `<SessionProvider>`, `useSession`, `signIn`, `signOut`
- ✅ `getServerSession()` / `auth()` / `pagesAuth()`
- ✅ Middleware de edge `withAuth()`
- ✅ Bridge para Pages Router (`toPages()`)
- ✅ Páginas de sign-in e erro integradas
- ✅ Tipos genéricos sem module augmentation
- ✅ **Providers OAuth** — Discord, Facebook, LinkedIn, Twitch, Spotify, Microsoft/Azure AD, Twitter/X (OAuth2 + PKCE), Apple (JWT client_secret ES256 via Web Crypto)
- ✅ **Provider Email / Magic Link** — `EmailProvider` + `ResendTransport`, `handleEmailSignin`, `handleEmailVerify`, página verify-request, `CloudflareKVAdapter` estendido com métodos de usuário e token de verificação
