# Contributing to VinextAuth

Thank you for your interest in contributing! Here's everything you need to get started.

## Branching strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production — matches the latest npm release. Protected, no direct pushes. |
| `develop` | Integration branch — all PRs target here. |
| `feature/your-feature` | Your work. Branch off from `develop`. |

## How to contribute

### 1. Fork the repository

Click **Fork** on GitHub, then clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/vinextauth.git
cd vinextauth
```

### 2. Add the upstream remote

```bash
git remote add upstream https://github.com/diogopaesdev/vinextauth.git
```

### 3. Create a branch from `develop`

```bash
git checkout develop
git pull upstream develop
git checkout -b feature/your-feature-name
```

### 4. Set up the project

```bash
npm install
npm run build
npm run typecheck
```

### 5. Make your changes

- Keep changes focused — one feature or fix per PR.
- Do not add runtime dependencies. VinextAuth has zero — let's keep it that way.
- Edge runtime compatibility is required: no `fs`, `path`, `crypto` (Node), `Buffer`, etc.
- Use only Web Crypto API (`crypto.subtle`, `crypto.getRandomValues`).

### 6. Verify your changes

```bash
npm run typecheck   # must pass with zero errors
npm run build       # must succeed
```

### 7. Open a Pull Request

Push your branch and open a PR **targeting `develop`** (not `main`).

```bash
git push origin feature/your-feature-name
```

Fill in the PR template and describe what changed and why.

## What we accept

- Bug fixes
- Security improvements
- New OAuth providers (Google, GitHub style)
- New adapters (Cloudflare D1, Upstash Redis, etc.)
- Documentation improvements

## What we don't accept

- Runtime dependencies
- Node.js-only APIs
- Breaking changes without prior discussion (open an issue first)

## Code style

- TypeScript strict mode
- No `any` unless truly unavoidable
- Prefer explicit types over inference in public APIs
- Short, focused functions

## Reporting security issues

Please do **not** open a public issue for security vulnerabilities.
See [SECURITY.md](./SECURITY.md) for the responsible disclosure process.
