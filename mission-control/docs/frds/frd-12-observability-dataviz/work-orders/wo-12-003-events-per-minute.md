# WO-12-003 — Events-per-minute selector (per-agent)

**Components/Interfaces:** `IF-12-rate` · **Traces:** REQ-12-007
**Deploy unit:** observability selectors (pure) · **Location:** `app/_observability/selectors/rate.ts` (+ `.test.ts`)

## Acceptance criteria (verbatim EARS)
- AC-12-007.1: The honest metrics (..., events per minute) SHALL be derived from the same event file, with no extra instrumentation.

## Scope
- `eventsPerMinute(events, window): Bucket[]` — bucket the event tail into per-minute counts over a window; optional per-agent breakdown (`Bucket = { minute, total, byAgent }`).
- **Consumed by FRD-06 `ActivityPulse` (WO-06-009) and FRD-18** — this is the single source of the rate metric (no duplication).

## Dependencies
- FRD-01 `lib/events` types.

## TDD / Definition of done
- Tests: events grouped into the right minute buckets; per-agent counts sum to the total; an empty/old window yields empty/zero buckets (drives the "stalled" pulse); deterministic given a fixed `now`.
- Pure. Gate green.
