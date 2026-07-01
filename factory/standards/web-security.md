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

## Supply chain, SSRF & abuse (canonical for rules/web-security.md)

> Severity: **MUST** (web). Enforcement: lockfile/`.npmrc` config + CI gate (gitleaks, audit) + code review. The per-project HOW lives in `plugin/templates/rules/web-security.md`; this section is the canonical WHY+WHAT.

- **Pin exact dependency versions** (no `^`/`~`) and install from the committed lockfile with immutable installs. **New-release cooldown ~7 days**: never install/auto-bump a version published less than a week ago (compromised releases are usually caught within days). This **composes with DR-052's "`@latest` at install time"**: latest-at-adoption (a new project takes the newest *stable, cooled-down* version), **pinned-thereafter** (no drift until a deliberate upgrade).
- **Disable install lifecycle scripts** by default (`ignore-scripts` / pnpm's script gating); allow-list only trusted packages — install-time scripts are the top supply-chain execution vector.
- **Secret scanning in the gate**: `gitleaks` runs in CI and as a pre-commit hook; platform push protection on.
- **Pin third-party GitHub Actions to a full commit SHA** (a tag is mutable); workflow `GITHUB_TOKEN` defaults to `contents: read`.
- **SSRF**: any server-side fetch of a user-influenced URL goes through a shared **`safeFetch` wrapper** — allow-list hosts, force https, reject credentials/`@` userinfo, block private/loopback/link-local ranges + cloud metadata (`169.254.169.254`), re-validate on every redirect hop. Never a raw `fetch(userUrl)`.
- **Rate-limit auth and unauthenticated public endpoints** (login, signup, reset, OTP, token issuance) with per-account failure counting and progressive backoff (no lockout-DoS).

**Why.** Supply-chain compromise is a top attack vector: the attack ships inside a "trusted" dependency or CI action, so the defense is pinning + cooldown + no-scripts, not vigilance. SSRF and credential-stuffing are the two abuse classes every public web app meets on day 1; a shared wrapper and default rate limits make the safe path the easy path.
