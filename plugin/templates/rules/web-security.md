---
description: Baseline web security — boundary validation, no secrets in code, security headers.
applies_when: public-web
globs: ["app/**", "src/**", "next.config.*", "middleware.*"]
source: Pandacorp standard — web-security
---

# Web security (baseline)

## Inputs & authorization
- **Validate every external input** at the boundary (Server Actions, route handlers, public APIs) with schemas — see `code-conventions`.
- **Authorize on the server, every time.** Never trust that the client already checked. Each mutation/endpoint verifies the caller's identity and permissions.

## Secrets
- **No secrets in code or in the repo.** Use environment variables / a secrets manager; keep `.env.example` with placeholder values only.
- Never log secrets or PII.

## Security headers (set them, with safe defaults)
- `Strict-Transport-Security` (HSTS, with preload once verified), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`.
- Remove framework/server version banners.
- A **Content-Security-Policy** with nonce/hash (start in report-only, then enforce).
- Verify headers in CI (a header-scan that fails closed).

## Auth
- **Never roll your own auth** — use a proven library/service.
