# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | Yes       |
| < 0.3   | No        |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately via GitHub's Security Advisories:

1. Go to the [Security tab](https://github.com/diogopaesdev/vinextauth/security/advisories/new) of this repository.
2. Click **"New draft security advisory"**.
3. Describe the vulnerability, steps to reproduce, and potential impact.

You can expect an initial response within **48 hours** and a fix or mitigation plan within **7 days** for critical issues.

## Scope

In scope:
- Authentication bypass
- Session hijacking or fixation
- CSRF vulnerabilities
- Open redirect vulnerabilities
- JWT forgery or algorithm confusion
- Credential exposure

Out of scope:
- Vulnerabilities in peer dependencies (React, Next.js)
- Issues requiring physical access to the server
- Social engineering

## Disclosure policy

We follow coordinated disclosure. Once a fix is ready and released, we will:
1. Publish a GitHub Security Advisory
2. Credit the reporter (unless they prefer to remain anonymous)
3. Release a patch version on npm
