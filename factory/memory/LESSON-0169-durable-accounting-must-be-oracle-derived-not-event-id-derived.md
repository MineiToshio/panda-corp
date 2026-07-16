---
id: LESSON-0169
type: anti-pattern
domain: telemetry-accounting
tags: [telemetry, gamification, trust-boundary, event-sourcing, security]
context: durable reward/XP/achievement/billing predicates computed from an append-only local event log
trigger: use this when a system awards durable state (XP, achievements, billing counters, unlocks) from an event stream and is tempted to trust the stream's own self-reported identity fields as proof
source: "mission-control — commit 5ee83d4e \"feat(factory): add native Codex runtime portability\" (R9 gamification ledger v2); docs/decision-log.md 2026-07-11 \"R9 durable accounting is oracle-derived, not event-ID-derived\""
provenance: agent-inferred
created: 2026-07-16
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** Mission Control's gamification layer originally used an in-memory semantic tail filter
keyed by producer-supplied `event_id`, `run_id`, agent, role, mode, timestamp and verdict to decide
which events counted toward durable XP/achievements. Any local process able to append to the event
stream could also forge those same fields.

**Lesson:** `event_id`/`run_id`/agent/role/mode/timestamp/verdict are producer *claims*, not proof — they
can deduplicate a feed but cannot certify a result, because the same actor that writes the stream can
write those fields however it likes. The durable fix was a persisted ledger whose sole writer re-reads
the actual canonical source artifacts (WO/FRD/`status.yaml`/build artifacts) and materializes only
fields it can independently corroborate against them — never the stream's self-reported identity alone.
It migrated valid prior state, refused corrupt/symlinked stores, and was proven with adversarial security
tests: stream deletion/mutation, alias/transport replay, forged identity/attribution, corrupt migration,
concurrent reconciliation, and the explicit empty-durable boundary.

**Apply next time:** when a dashboard/game layer/billing counter derives durable state from an
append-only telemetry stream, never let the stream's own fields be the trust boundary. Add an oracle
step that re-derives or corroborates against independently-owned canonical files (not the event log
itself) before writing anything durable, and explicitly test the adversarial cases — forged, duplicated,
replayed or corrupted events — not just the happy path.
