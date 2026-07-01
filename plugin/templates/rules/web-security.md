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
- **Human gate: the submit to hstspreload.org is durable and hard to revert → the OWNER approves it, never the agent.**
- Remove framework/server version banners.
- A **Content-Security-Policy** with nonce/hash (start in report-only, then enforce).
- Verify headers in CI (a header-scan that fails closed).

## Auth
- **Never roll your own auth** — use a proven library/service.
- **Rate-limit** all auth and unauthenticated public endpoints (login, signup, reset, OTP, token issuance); count failures per-account, with progressive backoff (no lockout-DoS).

## Injection
- **Never pass untrusted data to `dangerouslySetInnerHTML`, `eval`, `Function` or `innerHTML`** without a vetted sanitizer (DOMPurify); prefer text rendering. (Biome: `noDangerouslySetInnerHtml`, `noGlobalEval` → error)
- **SSRF**: server-side fetches of user-supplied URLs go through a shared `safeFetch` — allow-list hosts, force https, reject credentials/`@`, block private/loopback/link-local + cloud metadata (`169.254.169.254`), re-validate on every redirect hop.

## Supply chain (a top-2025 attack vector)
- **Install from the committed lockfile** with immutable installs (`npm ci` / `pnpm install --frozen-lockfile`); build fails if `package.json` and the lockfile diverge. **Pin exact versions** (no `^`/`~`).
- **Disable install lifecycle scripts by default** (`ignore-scripts=true` in `.npmrc` / pnpm `enable-pre-post-scripts=false`); allow-list only trusted packages that need them.
- **Dependency cooldown**: don't install/auto-bump a version published < ~7 days ago (`.npmrc` `min-release-age` / Renovate `minimumReleaseAge`).
- **CI dependency audit** on every PR + scheduled, failing on high/critical (`npm audit --audit-level=high` or Snyk/osv-scanner); a bot (Dependabot/Renovate) keeps deps current.
- **Secret scanning** in CI **and** as a pre-commit hook (`gitleaks`); enable platform push protection.
- **Pin third-party GitHub Actions to a full commit SHA** (not a tag); set workflow default `GITHUB_TOKEN` to `contents: read`, elevating per-job only as needed.
