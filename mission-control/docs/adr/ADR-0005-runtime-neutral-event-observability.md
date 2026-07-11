# ADR-0005 — Runtime-neutral event observability

- **Status:** Accepted
- **Date:** 2026-07-11
- **Decision:** Proposal 32 R9

## Context

Mission Control historically read one Claude-specific NDJSON file. Codex needs local telemetry, but duplicating event names and counting both transports would inflate XP/achievements. Events also must never become a competing source for phase or work-order state.

## Decision

`plugin/runtime/event-vocabulary.json` is the only authoring source for semantic acts, aliases and La Fragua display names. A deterministic generator projects it into Mission Control and the derived drift gate compares the projection byte-for-byte. Claude retains its legacy stream; Codex appends an enriched local stream with `runtime`, `run_id`, `event_id`, `subject` and the canonical display name.

Mission Control dual-reads, exact-deduplicates by `event_id`, chronologically merges independent
transport tails before applying the cap, and normalizes stable semantic names. A lifecycle observation
is not silently promoted into a result: `dispatch.finished` is distinct from `agent.done`, and
`change.reconciled` is distinct from `change.integrated`, even though La Fragua may reuse a familiar
display glyph. Transport identity and `(run_id,event_name,subject)` dedup are observability hygiene,
not an accounting trust boundary. Durable XP/achievement predicates consume version-2 facts from the
existing `factory/gamification-ledger.json`; its sole Server Action writer independently re-reads
server-side state and admits an event only when a canonical WO/FRD/status/artifact oracle corroborates
the result. The stored event is materialized from that oracle and drops uncorroborated agent, role,
mode, timestamp and claimed verdict fields. Pre-contract legacy events still render in the feed but
never become durable facts merely because they exist. Phase, WO and build truth remain file-derived.

A shared HMAC was rejected: Claude Dynamic Workflow shell emitters and any local process would read
the same local key, so it would authenticate access to the machine rather than the claimed outcome.
File/git oracles are both simpler and stronger for this local threat model.

Plugin freshness follows the same adapter rule: Claude and Codex installed caches get separate verdicts; neither cache stands in for the other.

## Consequences

- Runtime transports can differ without creating a second semantic vocabulary.
- Replays and vocabulary variants cannot inflate result accounting.
- La Fragua keeps its established visual language.
- Missing/deleted telemetry reduces observability only; after reconciliation it cannot reduce durable
  XP or unlocks. Rotations, aliases and cross-transport replay are idempotent.
- Agent/role/mode, time-of-day, relaunch and subagent observations remain live telemetry until a
  durable oracle exists. They do not award durable XP or unlock achievements in production.
- Version 1 ledger maxima migrate once to v2 without inventing historical event facts. Corrupt v2
  data fails closed and the writer refuses to overwrite it.
- A configured transport override isolates the reader to the explicitly configured transport(s); a
  failing external transport append never controls the executor.
- A vocabulary change requires regenerating the Mission Control projection and passing drift tests.
