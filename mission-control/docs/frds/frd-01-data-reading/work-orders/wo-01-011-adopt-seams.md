---
id: WO-01-011
type: work-order
slug: adopt-seams
title: 'WO-01-011 — Adopt the clock and git seams in the kept readers'
status: DRAFT
parent: FRD-01
foundation: false
implementation_status: PLANNED
difficulty: low
reopen_count: 0
artifacts:
  - 'src/lib/achievements/report/**'
  - 'src/lib/achievements/read-model/**'
  - 'src/lib/snapshot/**'
  - 'src/lib/memory/memory-health.ts'
  - 'src/lib/self-suggest/**'
  - 'src/lib/gamification/ledger.ts'
  - 'src/lib/build-track/**'
  - 'src/lib/git/fixtureAnswers.ts'
  - 'src/lib/git/_tests/gitBoundary.test.ts'
  - 'src/app/api/live/**'
  - 'src/app/api/plugin-sync/**'
  - 'src/app/_actions/snapshotLedger.ts'
source_requirements: [REQ-01-008, REQ-01-011]
dependsOn: [WO-01-010, WO-10-014, WO-23-006, WO-14-001, WO-17-003, WO-17-005, WO-17-008, WO-09-006, WO-01-009, WO-15-003]
last_updated: 2026-10-22
---

# WO-01-011 Adopt the clock and git seams in the kept readers

## Summary

Routes every `Date.now()` / `new Date()` and every git call in the readers that no v2 work order rewrites
through `now()` and `runGit()` (WO-01-010), so the close-out fidelity gate sees the same frozen instant
and the same fixture history on the FRD-10, FRD-18 and FRD-04 states that depend on them. Behaviour does
not change. It also extends the git fixture answer table with the history families those readers issue and
adds a guard test that keeps `child_process` inside `src/lib/git/`.

## In Scope

- In the readers listed in `artifacts`: replace the wall clock with `now()` (`.getTime()` where a number is
  needed) and every `execSync` / `execFileSync("git", …)` with `runGit(args, cwd)`. Pure functions that
  already receive an injected `now` stay as they are: they are the caller's concern.
- Fail-soft behaviour is preserved: a `GitError` takes the same path a failing git took before (null /
  documented fallback), never a thrown render error and never a silent empty list (DR-078: the existing
  equivalence tests of FRD-23 and the golden vectors of FRD-24 must stay green unchanged).
- `src/lib/git/fixtureAnswers.ts`: add the history families the migrated readers issue, answered from the
  fixture's `phaseHistory`, `verifiedAt` and per-repo `commits` / `lastActivity`:
  the phase-transition log of `status.yaml` (`phaseTransitions`), the flow-series log of `docs/frds`
  (`flowSeries`), the work-order commit timeline of `build-track`, and the stats-seal `log -1 --format=%H`
  (a fixed fixture hash, so the read-model takes its documented live-reader fallback). Output shapes are
  pinned by each reader's parser and its existing tests; derive them from those sources.
- `src/lib/git/_tests/gitBoundary.test.ts`: a repository scan asserting that `node:child_process` is
  imported only under `src/lib/git/` among the non-test sources of `src/` (the invariant of
  architecture.md §6, "the only git boundary").

## Out of Scope

- Readers and pages owned by a v2 work order: they adopt the seams themselves (`pendingMerge` WO-21-003,
  `changes` WO-04-012, the portfolio overview WO-03-007, Inicio WO-18-002, the Logros pages WO-10-016 /
  WO-10-017, the shell WO-19-002 / WO-19-003). App pages and components are not touched here.
- The clock or git seam definitions (WO-01-010) and any behavioural change of a reader.
- `src/lib/events/**` (the stream readers take no clock; their consumers pass `now`).

## Requirements & Acceptance Criteria

FRD-01 is REQ-only by design (no `AC-01-*` bullet), so this work order owns no acceptance criterion. It
enables the oracle-mode states of FRD-10, FRD-18 and FRD-04 and keeps REQ-01-008 (live / no-signal read the
clock) and REQ-01-011 (git is read-only, one boundary) true everywhere. Source: architecture.md §7
"Fixture seams (oracle mode, ADR-0012)".

## Components & Interfaces

`CMP-01-seam-adoption` (this work order's changes to the readers above) consuming `IF-01-now` and
`IF-01-runGit`; it adds answer families to `CMP-01-git`'s table. See `../blueprint.md`.

## Reuse

No new abstraction: the readers import `now` from `@/lib/clock/clock` and `runGit` from `@/lib/git/git`
(CLIs under `scripts/` import them relatively through the repo's `ts-loader`).

## Installs

None.

## Visual reference

N/A: not a UI work order.

## Tests this WO owns

- Updates, in the same work order, of the existing tests of each migrated reader that spy on
  `child_process` or fake `Date` so they go through the seams instead (implementer-authored files only).
- New fixture-mode tests per migrated family: with `MC_GIT_FIXTURE` and `MC_CLOCK` set the reader returns
  the value recorded for the oracle states (for example the phase funnel and the verified dates), and with
  no variable set it behaves as before.
- `src/lib/git/_tests/gitBoundary.test.ts` (above).

## Derogated tests

Reviewer-authored tests (`*.reviewer.test.*`) under the migrated folders are never edited by the
implementer. If one of them spies directly on `child_process` it is listed in the Status Note as derogated
and the FRD-01 gate reviewer rewrites it (DR-080); the implementer does not weaken it to go green.

## Definition of done

- Written first (RED), then GREEN: the fixture-mode tests and the boundary test.
- `.pandacorp/verify.sh` green: biome, `tsc --strict`, vitest (FRD-23 equivalence and FRD-24 golden vectors
  untouched), knip, madge.
- Error path per failure mode: git unavailable, git timeout, fixture without an answer, invalid
  `MC_CLOCK`; each keeps the reader's documented fallback and never turns a failure into an empty success.
- Non-functional: no behaviour or performance regression (the subprocess fan-out limits of
  `phaseTransitions` / `flowSeries` stay); no write; no secret.
- Cite `LESSON-0450` where a harness default root is touched.

## Dependencies

WO-01-010 (the seams) and the owners of each migrated reader: WO-10-014, WO-23-006, WO-14-001, WO-17-003,
WO-17-005, WO-17-008, WO-09-006, WO-01-009, WO-15-003. Enables the oracle-mode run of the close-out Visual QA.

## Status Note
