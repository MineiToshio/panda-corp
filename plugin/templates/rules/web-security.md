---
description: Baseline web security — boundary validation, no secrets in code, security headers.
applies_when: public-web
globs: ["app/**", "src/**", "next.config.*", "middleware.*"]
source: Pandacorp standard — web-security
---

# Web security (baseline)

(Injection sinks `dangerouslySetInnerHTML`/`eval` are mechanically banned by Biome `noDangerouslySetInnerHtml` + `noGlobalEval` in the canonical `biome.json`; fix the gate's message, don't argue with it.)

## Inputs & authorization
- Validate every external input at the boundary (Server Actions, route handlers, public APIs) with schemas — see `code-conventions`.
- **Authorize on the server, every time**: each mutation/endpoint verifies the caller's identity and permissions; never trust that the client already checked.

## Secrets
- No secrets in code or the repo — env vars / a secrets manager; `.env.example` holds placeholders only. Never log secrets or PII.

## Security headers
- Set `Strict-Transport-Security` (preload once verified), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`; remove version banners.
- **Human gate: the hstspreload.org submit is durable and hard to revert → the OWNER approves it, never the agent.**
- **Content-Security-Policy** with nonce/hash — start report-only, then enforce. Verify headers in CI (fail-closed header scan).

## Auth & injection
- **Never roll your own auth** — use a proven library/service.
- **Rate-limit** all auth and unauthenticated public endpoints (login, signup, reset, OTP, token issuance); count failures per-account with progressive backoff (no lockout-DoS).
- Untrusted data never reaches `innerHTML` or any HTML sink without a vetted sanitizer (DOMPurify); prefer text rendering.
- **SSRF**: server-side fetches of user-supplied URLs go through a shared `safeFetch` — allow-list hosts, force https, reject credentials/`@`, block private/loopback/link-local + cloud metadata (`169.254.169.254`), re-validate every redirect hop.

## Supply chain
- Install from the committed lockfile with immutable installs (`pnpm install --frozen-lockfile`); **pin exact versions** (no `^`/`~`).
- **Disable install lifecycle scripts by default** (`ignore-scripts=true` / pnpm `enable-pre-post-scripts=false`); allow-list only trusted packages.
- **Dependency cooldown**: don't install/auto-bump a version published < ~7 days ago (`min-release-age` / Renovate `minimumReleaseAge`).
- CI dependency audit on every PR + scheduled, failing on high/critical; a bot (Dependabot/Renovate) keeps deps current.
- Secret scanning in CI **and** pre-commit (`gitleaks`); enable platform push protection.
- Pin third-party GitHub Actions to a full commit SHA; default `GITHUB_TOKEN` to `contents: read`, elevate per-job.
