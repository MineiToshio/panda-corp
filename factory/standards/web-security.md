# Web security (headers / CSP)

> Domain: Security · Severity: **MUST** (web). Enforcement: CI gate (header-scan) + human gate for the preload. Consolidates what was scattered (constitution §12, DR-017, `security-auditor`). See DR-027.

## Rule — headers (literal pre-approved values)
Set in `next.config` `headers()` or middleware:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`)
- `Permissions-Policy: geolocation=(), camera=(), microphone=()`
- **Remove** `X-Powered-By` and `Server` banners.

## Rule — CSP
- **CSP with nonce/hash, without `unsafe-inline`** is the goal, but **in v1 it goes in `report-only`** (non-blocking): the per-request nonce breaks with PostHog/Sentry/Stripe (all in the stack). It is hardened as the project matures.

## How it is verified
- **Header-scan test in CI** (turns the decorative "security headers" into something fail-closed): asserts that each header is present with its value.
- The **submit to hstspreload.org is durable and hard to revert → the owner approves it**, not the agent.

## Why
These headers are cheap and cut off whole classes of attacks (clickjacking, sniffing, referrer leakage). That is why they are a literal default, not a per-project decision.

Sources: owasp HTTP_Headers_Cheat_Sheet · owasp Content_Security_Policy_Cheat_Sheet · nextjs production-checklist
