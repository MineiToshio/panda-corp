---
id: WO-10-009
type: work-order
slug: events-reader-extension
title: 'WO-10-009 — Events reader extension: surface real enriched fields (fail-loud)'
status: ACTIVE
parent: FRD-10
implementation_status: IN_PROGRESS
source_requirements: []
artifacts: [src/lib/events/events.ts, src/lib/events/_tests/**]
difficulty: medium
dependsOn: []
last_updated: '2026-06-29'
---
# WO-10-009 — Events reader extension: surface the real enriched fields

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`. Catalogue + real-signal map in
[`docs/achievements.md`](../../../achievements.md) §1.

## Goal
The achievements engine can only honestly unlock trophies if the event reader surfaces the fields the
real factory events actually carry. Today `lib/events/events.ts` maps only a fixed subset of `data.*`
(`frd`, `phase`, `activity`, `mode`, `role`, `wo`). Extend it to also surface the REAL enriched fields
the live stream carries (verified 2026-06-29), **without breaking** existing consumers (FRD-06 Party,
FRD-09 guild).

## In Scope
- Extend the `Event` type + parser with the real enriched fields, read from the nested `data` object
  (the real emitter shape) with top-level fallback (AC-06-008.2 backward-compat):
  `verdict` ("APPROVED" | "PASS" | "REJECT" | string), `result` ("green" | string),
  `reopenCount` (`data.reopen_count`), `blocking`, `important`, `agentType` (`data.agent_type`),
  `effortLevel` (`data.effort.level`), `maxAgents`, `wos`/`frds` (BuildComplete progress strings),
  `reason`.
- **Fail-loud parse (DR-078):** a recognised event whose enriched shape is the wrong *type* drops only
  that field (existing behaviour) — but the reader must still distinguish "source empty" from
  "unparseable file". Keep the per-line tolerant skip for malformed JSON; do NOT silently coerce.
- Provide an **uncapped read path** for the achievements engine (only-grow counters must see the whole
  stream): either a `cap` already accepts a large value, or add an explicit `readEvents({ cap })`
  call-site note — do NOT change FRD-09's tailed default.

## Out of Scope
- The signals derivation (WO-10-010) and the catalogue (WO-10-011).
- Any change to FRD-06 Party rendering or FRD-09 guild XP behaviour.

## Acceptance criteria (EARS)
- **AC-10-009.1** — Given a real `AgentDone`/`ReviewVerdict`/`GateResult`/`GateVerdict`/`BuildLaunch`/`BuildComplete`/`BuildRelaunch`/`AgentFinding`/`SubagentStop` line, the parsed `Event` SHALL expose the corresponding enriched fields above (typed), read from `data.*`.
- **AC-10-009.2** — Wrong-typed enriched fields SHALL be dropped individually (the event is still parsed); malformed JSON lines SHALL still be skipped — never throw on a single bad line.
- **AC-10-009.3** — Existing consumers SHALL be unaffected (FRD-06/09 tests stay green); new fields are additive and optional.
- **AC-10-009.4** — The reader SHALL be unit-tested against **real-shape fixtures** (the exact live shapes in `docs/achievements.md` §1) AND a malformed fixture.

## TDD plan
1. RED: fixtures of each real event shape; assert each enriched field surfaces; malformed-line skip.
2. GREEN: extend `Event` + `applyEnrichedFields`.
3. Refactor; keep `events.ts` ≤500 lines (split a helper if needed).

## Definition of done
`pnpm vitest run lib/events` green incl. new + existing; tsc + biome clean; no `any`; `.pandacorp/verify.sh` passes.
