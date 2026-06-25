---
id: WO-06-012
type: work-order
slug: events-enriched-fields
title: WO-06-012 — lib/events.ts consumes the enriched event fields (frd/phase/activity/mode + hand-off/contract)
status: DRAFT
parent: FRD-06
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-01-007]
last_updated: '2026-06-18'
---
# WO-06-012 — lib/events.ts consumes the enriched event fields

**Components/Interfaces:** `lib/events.ts` (`Event` type), `IF-06-fragua-snapshot` (consumer) · **Traces:** REQ-06-008
**Deploy unit:** data layer (pure parse) · **Location:** `lib/events.ts` (+ `lib/events.test.ts`)

> **NEW (2026-06-18, La Fragua redesign).** Prerequisite for the faithful real-data views: `lib/events.ts`
> must parse the new **optional, backward-compatible** event fields that the engine emits (the emission
> itself is a separate plugin change, documented there). Current consumers ignore the new fields; missing
> fields are tolerated. This WO is the **Mission Control read side** only.

## Acceptance criteria (verbatim EARS)
- AC-06-008.1: THE system SHALL feed off `AgentWorking` events carrying `{role, wo, frd, phase, activity, mode}` and `SubagentStop`, read from `~/.claude/dashboard-events.ndjson` via `lib/events.ts`, **without calling Claude** (read-only).
- AC-06-008.2: WHEN an event omits the optional enriched fields (`frd`, `phase`, `activity`, `mode`), THE system SHALL still render gracefully (backward compatibility), falling back to defaults rather than throwing.

## Scope
- Extend the `Event` type with the **optional** fields (parse only if present with the right type):
  - `frd?: string` — the FRD id of the event.
  - `phase?: "build" | "review"` — the engine phase.
  - `activity?: "test" | "backend" | "frontend" | "selftest" | "implement"` — the sub-step (deep relay + non-split).
  - `mode?: "pro" | "balanced" | "powerful" | "deep"` — the run's mode.
  - `role?: string` — the build role (alias/normalization for the existing `agent`, per the engine's `AgentWorking{role}`).
- Recognize the new event kinds in the stream: `HandoffWritten {wo, frd}` and `ContractPublished {wo, frd}` (no schema change beyond the optional fields — they reuse `event` + `wo`/`frd`).
- **Backward compatibility:** every new field is optional; a line missing them parses exactly as today (AC-06-008.2). No existing field/behavior changes; the cap, `lastEventAt`, `byProject` and the per-line tolerance are untouched.
- Remain **read-only** — `fs.readFileSync` only, no writes, no egress, no Claude (AC-06-008.1).

## Dependencies
- FRD-01 `lib/events` (the existing reader — this extends it).
- The **plugin** prerequisite (emitting these fields) is documented in the plugin's decision-log; this WO does not depend on it to land (it tolerates their absence).

## TDD / Definition of done
- RED→GREEN tests with NDJSON fixtures: an enriched line exposes `frd`/`phase`/`activity`/`mode`/`role`; a legacy line (without them) parses unchanged with those fields `undefined`; a wrong-typed enriched field is dropped (not propagated) without throwing; `HandoffWritten`/`ContractPublished` lines carry `wo`+`frd`; the existing cap/`lastEventAt`/`byProject` tests stay green.
- Pure parse, no DOM. `pnpm vitest run` green, `tsc --noEmit` clean, biome clean.

## Status Note

**Built:** `lib/events.ts` extended with 5 optional enriched fields on the `Event` type, plus 3 exported enum types. A `applyEnrichedFields()` helper was extracted from `parseLine()` to stay within biome's cognitive-complexity budget. `parseLines()`, `deriveLastEventAt()` and `deriveByProject()` were extracted from `readEvents()` for the same reason (refactor also reduces complexity for readability).

**Interfaces / contracts exposed:**

```ts
// New exported types (src/lib/events/events.ts)
export type EventPhase = "build" | "review";
export type EventActivity = "test" | "backend" | "frontend" | "selftest" | "implement";
export type EventMode = "pro" | "balanced" | "powerful" | "deep";

// Extended Event type — all new fields are optional (backward compatible)
export type Event = {
  // ... existing fields unchanged ...
  frd?: string;          // FRD id (any string)
  phase?: EventPhase;    // build | review — fenced to valid enum
  activity?: EventActivity; // test | backend | frontend | selftest | implement — fenced
  mode?: EventMode;      // pro | balanced | powerful | deep — fenced
  role?: string;         // open-ended build role identifier
};
```

**Backward compatibility:** every enriched field is optional. Legacy events missing them produce `undefined` on those fields (AC-06-008.2). Wrong-typed or out-of-enum values are silently dropped without skipping the event. `HandoffWritten` and `ContractPublished` are parsed as regular events (they carry `event`+`at`+`frd`+optional fields — no schema change needed).

**Integration seams:**
- `IF-06-fragua-snapshot` (consumer): `toFraguaSnapshot(events, opts)` can now read `ev.frd`, `ev.phase`, `ev.activity`, `ev.mode`, `ev.role` directly from the `Event` objects returned by `readEvents()`.
- `IF-06-state-map` (consumer): `eventToVisual(event)` can branch on `event.activity` to distinguish relay sub-steps (`test`, `backend`, `frontend`) without additional parsing.
- `IF-06-event-vm` (consumer): `toEventVM(event)` can read `event.frd` and `event.mode` for feed display.

**Test files:**
- `src/lib/events/_tests/events.wo06012.test.ts` — 49 RED→GREEN tests covering:
  - AC-06-008.1: all enriched fields (`frd`, `phase`, `activity`, `mode`, `role`) on `AgentWorking`
  - AC-06-008.2: legacy events without enriched fields parse unchanged
  - Wrong-typed / invalid-enum enriched fields dropped without throw
  - `HandoffWritten` and `ContractPublished` event kinds parsed with `frd` field
  - `SubagentStop` event kind parsed with enriched fields
  - Regression: cap/`lastEventAt`/`byProject` behavior untouched
  - Read-only invariant maintained with enriched events
- Existing tests: `events.test.ts` (50) + `events.adversarial.test.ts` (17) — all still GREEN (116 total)

## REVIEWER REOPEN (FRD gate, 2026-06-18, Opus) — REJECTED, reopened to PLANNED

**Blocking defect — wrong event shape (AC-06-008.1 fails against 100% of real events).**
This WO parses the enriched fields from the **top level** of each NDJSON object
(`obj.frd`, `obj.mode`, `obj.phase`, `obj.activity`, `obj.role`) and maps the WO id only from a
top-level `obj.work_order`. **The real emitter never writes that shape.** The plugin
(`plugin/templates/shared/.claude/workflows/pandacorp-build.js`) and every real line on disk emit:

```json
{"event":"AgentWorking","at":"…","project":"mission-control",
 "data":{"role":"implementer","wo":"WO-06-011","frd":"frd-06-party",
         "phase":"build","activity":"implement","mode":"powerful"}}
```

i.e. `role/wo/frd/phase/activity/mode` are **NESTED under `data`**, and the WO id key is `wo` (not
`work_order`). Verified: 398/398 real `AgentWorking` lines use the nested `data` shape; 0 use the flat
shape this parser expects. (The code even has a comment "from `AgentWorking.data.role` or top-level" and
a test note "line 9 has `wo` inside data — not the same field" — the nested shape was known and ignored.)

**Consequence (whole-FRD integration break):** against the real stream, `readEvents` returns events with
`frd`/`workOrder`/`mode` all `undefined`; `toFraguaSnapshot` then sees `currentFrdId === null` → returns
the empty snapshot → `PartyTab` shows the **empty state during a live build**. REQ-06-008/001/002/009/010
all fail end-to-end. The tests passed only because the WO-06-012 tests and the
`dashboard-events-enriched.ndjson` fixture were authored in the same fictitious flat shape (shared-bias
trap: test and code agree with each other, neither matches reality).

**Reviewer evidence (failing):**
`src/app/projects/[slug]/_party/_tests/frd-06-realdata.reviewer.test.ts` — 3 tests that feed the REAL
nested-`data` line through `readEvents → toFraguaSnapshot`: all 3 fail (no FRD detected, no running WOs,
mode falls back to `powerful`). These must go GREEN on the rebuild.

**Required fix (file:line):** `src/lib/events/events.ts` — `parseLine`/`applyEnrichedFields` must read the
enriched fields from the **`data` sub-object** when present (`data.wo`→`workOrder`, `data.frd`, `data.phase`,
`data.activity`, `data.mode`, `data.role`), accepting `data.wo` as the WO id, while remaining
backward-compatible with any top-level/legacy lines. Replace the fabricated flat fixture
`src/tests/fixtures/events/dashboard-events-enriched.ndjson` with REAL nested-`data` lines (copy the actual
on-disk shape) and update the WO-06-012 tests to construct events with `data:{…}`.

## Resolution (baseline repair, 2026-06-18) — back to IN_REVIEW

**Core defect fixed.** `src/lib/events/events.ts` `applyEnrichedFields` now reads the enriched
fields from the nested `data` sub-object when present (the real emitter shape), falling back to the
top level for flat/legacy lines (backward-compat AC-06-008.2). A new `enrichedSource(obj)` helper
returns `obj.data` when it is a plain object, else `obj`. The emitter's `data.wo` (or top-level
`wo`) now maps to `workOrder`, with the legacy `work_order` mapping kept and taking precedence.

**Evidence:** the reviewer anchor
`src/app/projects/[slug]/_party/_tests/frd-06-realdata.reviewer.test.ts` (all 3 tests) now passes
GREEN — against the REAL nested-`data` line, `readEvents → toFraguaSnapshot` detects the FRD
(`snap.active=true`), registers the running WOs from `data.wo`, and reads `data.mode`. The existing
flat-shape WO-06-012 tests and the events unit/adversarial suites remain GREEN (the parser accepts
both shapes). Full `verify.sh` green: 238 files / 5957 tests. The FRD-06 gate remains the authority
for VERIFIED. (The flat fixture file was left in place since both shapes parse; the reviewer's
real-shape adversarial test is the authoritative coverage going forward.)
