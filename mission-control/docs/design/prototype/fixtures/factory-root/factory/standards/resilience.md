# Resilience (outbound calls & third-party dependencies)

> Domain: Operation · Severity: **MUST** (timeouts, retry discipline, bulkhead) / **SHOULD** (fallback hierarchy) · Enforcement: `reviewer` correctness lens + `security-auditor` hardening checklist (named manual steps). Operative form: `rules/resilience.md` (DR-051).

## Rule — timeouts on EVERY outbound call
- **Every outbound call carries an explicit timeout.** `fetch(url, { signal: AbortSignal.timeout(ms) })` (the `safeFetch` wrapper — [web-security.md](web-security.md) SEC-7 — sets one by default); a DB `statement_timeout` on the Postgres/Neon connection; timeout options set on every third-party SDK. An unbounded wait is a hung request, a hung job, and eventually a hung pool.

## Rule — retries: one layer, idempotent only
- Retries use **exponential backoff + jitter**, apply **only to idempotent operations**, and live at **exactly one layer — the outermost caller**. Never nested (a retry inside a retried call multiplies attempts and load on an already-failing dependency).
- A non-idempotent operation that may be retried by a client needs an **idempotency key** instead (see [api-design.md](api-design.md) REST rules and [background-jobs.md](background-jobs.md)).

## Rule — fallback hierarchy (degrade honestly)
When a dependency fails, degrade in this order — and **honestly**:
1. **Cached/stale data, labeled as stale** — never presented as live (the liveness-honesty rule is canonical in [observability.md](observability.md), DR-066).
2. **Degraded UI state** — the feature says what it can't do right now.
3. **Honest error** — the designed error state ([error-handling.md](error-handling.md)), never a blank screen or a fake success.

## Rule — bulkhead: third-party outage ≠ core outage
- **A third-party outage must not take down the core flow.** Non-critical calls (analytics, error-tracking, email, enrichment) are wrapped/fire-and-forget/queued so their failure degrades only their own feature — a PostHog or Resend incident must never 500 the checkout.
- **Non-critical side effects are queued/deferred**, not awaited inline — canonical in [background-jobs.md](background-jobs.md).

## How it is verified
- **Timeouts present**: `reviewer` correctness lens over every new outbound call site (review-only); `security-auditor` hardening pass checks it alongside the SEC-7 safeFetch review (named manual step).
- **Retry discipline (one layer, idempotent, backoff+jitter)**: `reviewer` correctness lens (review-only).
- **Bulkhead / graceful degradation**: `reviewer` + adversarial tests that fail the dependency (DR-015: mock the third party down, assert the core flow survives); liveness honesty where a monitor exists → the wired OBS-3 gate.

## Why
Every production incident in a small SaaS eventually traces to an unbounded outbound call or a retry storm. Timeouts, single-layer retries and bulkheads are cheap at write time and unpayable at 3 a.m.; degrading honestly (stale-labeled → degraded → error) keeps the product trustworthy while a dependency is down.
