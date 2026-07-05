---
description: Resilience — timeouts everywhere, single-layer retries, honest fallbacks, bulkheads, background jobs.
applies_when: always
globs: ["**/*.ts", "**/*.tsx", "**/*.py"]
source: Pandacorp standard — resilience
---

# Resilience & background work

- **Every outbound call has an explicit timeout**: `fetch(url, { signal: AbortSignal.timeout(ms) })`, DB `statement_timeout`, timeout options on every third-party SDK. No unbounded waits.
- **Retries**: exponential backoff + jitter, **only idempotent operations**, at **one layer — the outermost caller**. Never nested retries.
- **Degrade honestly** when a dependency fails: cached/stale data **labeled as stale** → degraded UI state → the designed error state. Never present stale as live, never fake success.
- **Bulkhead**: a third-party outage (analytics, email, error-tracking, payments) must not take down the core flow — wrap non-critical calls so their failure degrades only their own feature.
- **Background jobs**: work over ~5 s or any retriable side effect (email, webhooks, sync) goes to a job (cron/queue), never an inline `await` in the request.
- Every job handler is **idempotent** and carries an **idempotency key** — retries and overlaps WILL happen; check the key (or a unique constraint) before side effects.
- A job that exhausts its retries lands in a **visible dead-letter state** (Sentry event + queryable status) — never silently dropped. Log start/end/duration per run.
