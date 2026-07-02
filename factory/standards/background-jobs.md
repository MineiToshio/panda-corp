# Background jobs

> Domain: Operation · Severity: **MUST** (whenever a job exists) · Enforcement: `reviewer` correctness lens + hardening checklist (named manual steps). Operative form: folded into `rules/resilience.md` (jobs bullets) — no separate rule file (DR-051, stated deliberately: jobs rules only matter alongside the resilience discipline they extend).

## Rule — when to reach for a job
- Anything **longer than ~5 s** of request time, or any **retriable side effect** (email, webhook fan-out, sync, report generation), runs as a job — never an inline `await` in the request/action. The request records intent and returns; the job does the work.

## Rule — the golden path
- **Scheduled work** → **Vercel Cron** hitting an idempotent route handler (authenticated via the cron secret).
- **Event-driven work** → **QStash/Upstash** (managed queue with retries) **or a DB-backed queue** (a jobs table + a cron drain) — pick the simplest that fits; at MVP scale the DB-backed queue is usually enough and adds no new service. The choice is recorded in the blueprint.

## Rule — idempotency is mandatory
- Every job carries an **idempotency key** and every handler is **safe to run twice** — retries, cron overlaps and at-least-once delivery WILL happen. Check-then-act on the key (or a unique constraint) before side effects.

## Rule — retry policy & dead-letter honesty
- **Bounded retries with backoff** (per [resilience.md](resilience.md) — one layer, the queue's own retry mechanism IS that layer for jobs).
- A job that exhausts its retries lands in a **visible dead-letter state**: a Sentry event **and** a queryable status (a `failed` row / DLQ), so it can be replayed or written off deliberately. **A silently-dropped job is the DR-078 silent-`[]` failure** applied to work instead of data ([quality.md](quality.md)) — forbidden.

## Rule — job observability
- Every run **logs start/end/duration** (structured, [observability.md](observability.md) OBS-1); failures reach **Sentry**; a long-running job heartbeats so a monitor can tell hung from busy (DR-066).

## How it is verified
- **Idempotency + retry/dead-letter design**: `reviewer` correctness lens at the FRD gate — a job handler without an idempotency key or with an invisible failure path is a blocking finding (review-only); adversarial tests run the handler twice with the same key (DR-015).
- **Sentry on failure + start/end/duration logs**: the hardening checklist in `/pandacorp:implement`'s final step (OBS-1/OBS-2 named steps).
- **Queue choice declared**: blueprint readiness gate (DR-100).

## Why
Background work is where failures go to hide: nobody is watching the response. Idempotency makes retries safe, and dead-letter visibility makes failure a state you can see and replay — instead of work that silently never happened.
