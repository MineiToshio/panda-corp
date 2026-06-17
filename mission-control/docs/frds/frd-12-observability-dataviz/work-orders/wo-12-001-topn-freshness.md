---
id: WO-12-001
type: work-order
slug: topn-freshness
title: WO-12-001 — Top-N cap helper + freshness selector
status: ACTIVE
parent: FRD-12
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-12-001 — Top-N cap helper + freshness selector

**Components/Interfaces:** `IF-12-topn`, `IF-12-freshness` · **Traces:** REQ-12-004, REQ-12-002
**Deploy unit:** observability selectors (pure) · **Location:** `app/_observability/selectors/` (`topn.ts`, `freshness.ts` + `.test.ts`)

## Acceptance criteria (verbatim EARS)
- AC-12-004.1: ANY grouping or ranking (agents, events, metrics) SHALL be limited to the **top-5**.
- AC-12-002.1: The view SHALL show a **Live / No signal** indicator with the **timestamp of the last event** read from `dashboard-events.ndjson` (data freshness).

## Scope
- `topN(items, n=5)` — pure bounded-ranking helper; the single enforced top-5 cap.
- `freshness(events, now): { lastAt: string|null, live: boolean }` — newest `at`; `live` true when within a centralized threshold constant (e.g. recent enough), false → "Sin señal".
- Threshold is a named constant, not magic.

## Dependencies
- FRD-01 `lib/events` (`DashboardEvent` type). No I/O.

## TDD / Definition of done
- Tests: `topN` truncates to 5 and preserves order; n override works; empty → []. `freshness`: newest event wins; empty events → `{lastAt:null, live:false}`; an event older than the threshold → `live:false`; within → `live:true`.
- Pure. Gate green.

## Status

- [x] **Done** — `bash .pandacorp/verify.sh` passed: biome (no errors) + tsc --noEmit (clean) + vitest (1429 passed, 5 skipped).
- Implementation: `app/_observability/selectors/topn.ts`, `app/_observability/selectors/freshness.ts`
- Tests: `topn.test.ts`, `topn.adversarial.test.ts`, `freshness.test.ts`, `freshness.adversarial.test.ts`
- Commits: `c339c08` (selectors), `88a55b2` (export fix + tests)
- Safe-point SHA (post-commit): see `last_green_sha` in `.pandacorp/status.yaml`
