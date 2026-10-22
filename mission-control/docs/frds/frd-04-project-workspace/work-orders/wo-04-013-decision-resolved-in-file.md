---
id: WO-04-013
type: work-order
slug: decision-resolved-in-file
title: 'WO-04-013 — Decision reader: a decision resolved in its own file is never pending'
status: ACTIVE
parent: FRD-04
foundation: false
implementation_status: PLANNED
blocked_reason:
difficulty: low
reopen_count: 0
artifacts:
  - 'src/lib/docs/activity.ts'
  - 'src/lib/docs/_tests/activity.resolved-in-file.test.ts'
  - 'src/lib/changes/openChanges.ts'
  - 'src/lib/changes/_tests/openChanges.test.ts'
source_requirements: [REQ-04-004, REQ-04-014]
dependsOn: [WO-24-001, WO-04-001]
last_updated: 2026-10-22
change_ref: none
---

# WO-04-013 — Decision reader: a decision resolved in its own file is never pending

> **`implementation_status` is the build engine's source of truth.** `PLANNED → IN_PROGRESS → IN_REVIEW →
> VERIFIED`; never hand-set `VERIFIED`. Blueprint: [`../blueprint.md`](../blueprint.md) §4.4, §4.5.

## Summary

Fixes `readDecisions` so a decision whose own entry records a resolution (PersonalPage v2 `2026-07-01-1`:
`**Estado:** ✅ RESUELTO 2026-07-01` under a heading that still says «(necesita tu acción)») is resolved,
flagged `resolvedInFile: true` and never counted as pending; strips a leading «· » from titles and exposes one
engine-log predicate; ids stay byte-identical. Also adds `countOpenChanges`, the one open-changes count every
surface shares. Owner-bundled fix (PRD v2 «Bundled fixes» 2), no queue card.

## In Scope

- `src/lib/docs/activity.ts` (`parseDecisionBlocks`, shared by `readDecisions` and the FRD-24 CLI):
  - the `Estado` resolution record is recognized line-anchored (LESSON-0008) with optional list marker, bold
    markers and any non-letter characters (emoji, punctuation) before the status word; it wins over the
    heading's status phrase (existing precedence);
  - `DecisionPoint.resolvedInFile?: true` when that record resolves an entry the heading alone would leave
    pending (pending phrase or no phrase); absent otherwise, so existing deep-equality fixtures stay valid;
  - the title drops a leading «· » (and its spaces);
  - exported `isEngineLogEntry(point)`: true when the stripped title starts with a clock time
    (`HH:MM`, optionally `T`-prefixed) or an ISO date-time, the prototype's rule; consumers hide such entries
    with one rule (Resumen, Inicio).
- `countPendingDecisions` needs no change: a resolved-in-file entry is `resolved`, so the sidebar, Inicio and
  Portafolio counts drop it automatically (DR-092 single count).
- `src/lib/changes/openChanges.ts`: `countOpenChanges(projectPath)` = items of `readChangeQueue` whose status is
  not `done` / `discarded`; a typed result carrying the reader's errors instead of a silent `0` (DR-078). The
  `changes.ts` reader itself is not edited.

## Out of Scope

- Any change to the id derivation (FRD-24 non-goal): `<date>-<n>` / `legacy-<n>` counters untouched; the golden
  fixture and expected ids are not edited.
- Rendering (WO-04-011, WO-18-002, WO-19-003 consume these).
- Owner-pending change counts (ready/draft only, REQ-04-010): not this function.
- The optional `ask` / `context` fields of `DecisionPoint` for Inicio's «Detalles» dialog: WO-18-002 adds them
  to `activity.ts` in W5 (one writer per file per wave); this work order does not. A decision resolved in its
  own file keeps `resolved: true` (so `countPendingDecisions` and `ownerTurnItems()` exclude it).

## Requirements & Acceptance Criteria

No AC is owned here. This work order is the data side of AC-04-014.5 (owned by WO-04-011: «ya resuelta en el
archivo» and the worked example of the FRD) and of AC-04-014.2 / AC-04-014.3 (badges and tiles, owned by
WO-04-010 / WO-04-011, which read `countOpenChanges`). REQ-04-004 (decision bullets: obsolete never pending,
stable ids) stays satisfied.

Completeness (DR-100): fail-soft wrapper unchanged (missing/unreadable file → `[]`); a malformed `Estado` line
(no recognizable status word) leaves the heading classification; the open-changes count is never a fabricated
zero when the queue is unreadable; pure functions, no write.

## Visual reference

N/A (non-UI).

## Tests

- `src/lib/docs/_tests/activity.resolved-in-file.test.ts`: the PersonalPage v2 `2026-07-01-1` shape (heading
  with «· » and «(necesita tu acción)», `**Estado:** ✅ RESUELTO …` body line) → resolved, `resolvedInFile`
  true, title without «· », id `2026-07-01-1`, not counted by `countPendingDecisions`; an entry whose heading
  already says resolved → no `resolvedInFile`; `OBSOLETO` still obsolete; an emoji before `PENDIENTE` stays
  pending; `isEngineLogEntry` true for `T12:30 …`, `12:30 …`, `2026-10-20T08:00 …`, false for a dated
  decision title; a table of the existing fixtures proving every id and order is identical before and after
  the change (no new dependency: fast-check is not installed).
- `src/lib/changes/_tests/openChanges.test.ts`: every status counted correctly over a production-shaped queue;
  an unreadable item surfaces as an error result.
- Must stay green unmodified: `src/lib/docs/_tests/decision-id-golden.test.ts` and `docs.wo24001.test.ts`
  (FRD-24 golden vectors), `docs.wo04002.test.ts`, `docs.wo04002.reviewer.test.ts`.
- **Derogated tests:** none.

## Dependencies

WO-24-001 (`parseDecisionBlocks` extraction), WO-04-001 (`readDecisions` history).

## Definition of done

Regression test anchored in the PersonalPage v2 case fails before the fix and passes after; FRD-24 golden
vectors byte-identical; `.pandacorp/verify.sh` green; Status Note filled.

## Status Note
