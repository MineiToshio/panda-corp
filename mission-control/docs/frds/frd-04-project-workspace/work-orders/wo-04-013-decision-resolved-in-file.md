---
id: WO-04-013
type: work-order
slug: decision-resolved-in-file
title: 'WO-04-013 — Decision reader: a decision resolved in its own file is never pending'
status: ACTIVE
parent: FRD-04
foundation: false
implementation_status: VERIFIED
difficulty: low
reopen_count: 0
artifacts:
  - 'src/lib/docs/activity.ts'
  - 'src/lib/docs/_tests/activity.resolved-in-file.test.ts'
  - 'src/lib/changes/openChanges.ts'
  - 'src/lib/changes/_tests/openChanges.test.ts'
source_requirements: [REQ-04-004, REQ-04-014]
dependsOn: [WO-24-001, WO-04-001]
last_updated: 2026-10-30
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

Implemented the data contracts in blueprint §4.4/§4.5 without UI or ID-derivation changes.

- `DecisionPoint.resolvedInFile?: true` is present only when an explicit body resolution overrides a pending heading (including no heading status). Terminal headings do not acquire the marker. `Estado` accepts optional list/bold formatting and non-letter status prefixes; unknown/malformed statuses retain the heading classification. Obsolete and superseded body statuses remain terminal. The parser stays line-anchored, applying **LESSON-0008**, with a regression for status mentions embedded in prose.
- `isEngineLogEntry(point: Pick<DecisionPoint, "title">): boolean` identifies titles starting with `HH:MM`, `THH:MM` or an ISO date-time. Titles lose their leading middle dot; IDs and ordering still derive exclusively from headings. `countPendingDecisions(projectPath)` automatically excludes body-resolved entries.
- `countOpenChanges(projectPath: string): OpenChangesResult` returns `{ ok: true, count: number, errors: [] }` or `{ ok: false, count: null, errors: ChangeQueueReadResult["errors"] }`. Consumers must narrow `ok` and omit unknown counts; any reader error invalidates the whole count, including when valid items also exist. Open means ready/draft/building/closing, irrespective of type or archive location. Missing queues inherit the existing reader's legitimate empty result; filesystem discovery and its existing semantics remain owned by `readChangeQueue`.
- Tests: `activity.resolved-in-file.test.ts` covers the PersonalPage shape and pending count, malformed marker fallback, obsolete states, engine-title classification and unchanged golden IDs/order. `openChanges.test.ts` covers all six queue statuses, a Spanish production-shaped card, missing queue, malformed and unreadable items. Both new suites passed (16 tests) before handoff; final scoped verification follows the engine commit. No UI component or visual contract changed (Visual reference: N/A).

### 2026-10-30 reviewer repair

- `countOpenChanges` now checks queue and archive listing in `openChanges.ts` before using the existing
  reader. Only `ENOENT` is an empty-directory case; listing failures produce an unknown count with an
  explicit directory error, including when the other directory contains valid items. `changes.ts` is unchanged.
- The explicit Estado parser recognizes `RESUELTA` as resolved, retaining the existing obsolete and
  superseded handling. Engine-log clock prefixes accept one or two hour digits, including `T9:05`.
- Removed the empty `blocked_reason`; retained `implementation_status: IN_REVIEW` and aligned the README row.
- `pnpm exec vitest run src/lib/backlog src/lib/docs/_tests/activity src/lib/changes/_tests/openChanges --reporter=dot`: exit 0, 10 files / 194 tests passed (initial baseline: 14 reviewer failures).
- `pnpm exec vitest run src/lib/docs/_tests/decision-id-golden.test.ts src/lib/docs/_tests/docs.wo24001.test.ts src/lib/docs/_tests/docs.wo04002.test.ts src/lib/docs/_tests/docs.wo04002.reviewer.test.ts --reporter=dot`: exit 0, 4 files / 128 tests passed; golden vectors and reviewer tests unchanged.
- `bash .pandacorp/verify.sh --only=biome,tsc,knip`: exit 0. Non-failing output: existing Biome schema/CLI mismatch, nine Knip configuration hints; Vitest also reports Node experimental warnings.
- No commits or writes to the main checkout, reviewer tests, visual baselines or decision log. Browser verification was not attempted under the sandbox restriction; no port was supplied or inherited. The full verification suite was not run.

### 2026-10-30 — Independent gate: PASS

Reviewed at `6f5e908b`. The reviewer suites from `df40940e` are unchanged and green with the FRD-24 golden
vectors and the existing decision tests (322/322), and D4-D6 are closed. The old-vs-new parser run over the
funko-tracker, personal-page-v2 and mission-control decision files shows identical ids and only the intended
changes: PersonalPage `2026-07-01-1` is resolved and both «· » title prefixes are gone. Full `verify.sh` at
that SHA was NOT green: every sub-gate through vitest passed (8,328/8,328) and Playwright reported 179 passed,
12 skipped, 1 failed. The failure is `e2e/persistent-navigation.spec.ts:144` on mobile, which this work order
does not touch; the same class of failure reproduces at `f7a6573e` without this code (LESSON-0185 family,
cause unconfirmed). It is recorded as pre-existing, not waived as green. Logical data model: unchanged.
