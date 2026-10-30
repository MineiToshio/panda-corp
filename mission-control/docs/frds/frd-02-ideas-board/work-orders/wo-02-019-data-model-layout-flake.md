---
id: WO-02-019
type: work-order
slug: data-model-layout-flake
title: WO-02-019 Data-model async layout, confirm and fix the «Organizando modelo…» flake
status: ACTIVE
parent: FRD-02
foundation: false
implementation_status: PLANNED
difficulty: medium
reopen_count: 0
artifacts:
  - 'src/components/modules/DataModelViewer/**'
  - 'e2e/logical-data-model.spec.ts'
source_requirements: [REQ-02-015]
dependsOn: []
last_updated: '2026-10-22'
change_ref: data-model-viewer-layout-flaky-tests.md
---

# WO-02-019 Data-model async layout: confirm and fix the «Organizando modelo…» flake

## Summary

Investigate, with the `docs/rules/debugging.md` SOP, why one to three data-model viewer tests fail intermittently
under load with the viewer stuck on its layout-pending state (and the 1-in-3 flake of
`e2e/logical-data-model.spec.ts`), confirm the cause with evidence (product layout lifecycle or test harness), apply
the minimal fix where the cause lives, and anchor a regression test in it, so the asynchronous layout stays bounded,
cancellable and model-scoped and the suite is deterministic before the v2 restyle (WO-02-018) builds on it.

## In Scope

- **Reproduce first** on the current code (W0, before any restyle): repeated runs of
  `vitest run src/components/modules/DataModelViewer` alone and under parallel CPU load, and of
  `e2e/logical-data-model.spec.ts`; record the failing files, lines, timings and the pending state each time. Known
  sightings (queue card): `usability.reviewer.test.tsx`, `navigation.test.tsx:37`,
  `fullscreen.consistency.reviewer.test.tsx:73`.
- **Timeline:** when the flake first appeared versus the commits touching `useModelLayout.ts`, `elkEngine.ts`,
  `useViewport.ts`, the vitest/Playwright configuration and the machine load.
- **Suspects, each discarded or confirmed with direct evidence** (never "unlikely"): the layout never settles under
  contention (ELK adapter cost, worker start-up, the 20 s bound, a lost resolution after cancellation), a stale or
  cancelled response being applied to the current model identity, a test waiting with the library's default
  `findBy*` budget on work that legitimately takes longer under load, test isolation (shared ELK instance, fake timers,
  order dependence), and the harness itself (LESSON-0185: port/lock collision, cold-boot timing, hydration race,
  `networkidle`; LESSON-0450: hermetic roots). A confirmed cause predicts the failures AND explains why the other
  tests in the same files pass.
- **Fix minimal, where the cause lives:** in product code (`useModelLayout` / `elkEngine`: bounded, cancellable,
  model-scoped, explicit loading and error state, never blocking interaction) or in implementer-authored test waits
  (`navigation.test.tsx` and other non-reviewer files) or in `e2e/logical-data-model.spec.ts` (web-first assertions,
  no hard waits, no `networkidle`). **A fix inside a `*.reviewer.*` test is not made here** (DR-080): the WO records the
  evidence and the exact change needed in its Status Note, and the FRD-02 gate reviewer applies it (LESSON-0002:
  distinguish defective gate test from wrong production code).
- **Regression test** anchored in the confirmed cause (fails on the pre-fix code under the reproduced condition,
  passes after), plus the **sibling audit**: every test in the viewer folder and the e2e spec that waits on layout
  completion is checked for the same cause.
- **No cause found:** close with attribution guards (a layout-duration log at the error boundary in development, an
  assertion naming the model identity on stale responses, a bounded test helper that reports the pending phase on
  timeout) and record what was ruled out; never close as "flaky".

## Out of Scope

- Any visual change to the viewer (WO-02-018), any change to the layout algorithm's output (AC-02-015.10 stays
  byte-identical on the reviewer layout fixtures), the reader/validator (`src/lib/architecture/data-model/`).
- Editing reviewer-authored tests (`*.reviewer.*`) or blessed baselines.
- The workspace tab-list steps of `e2e/logical-data-model.spec.ts` (WO-04-010 rewrites them in W5).

## Requirements & Acceptance Criteria

- **AC-02-015.11** — WHEN asynchronous layout is pending, fails or belongs to a previous project, THE viewer SHALL show an explicit bounded loading/error state, isolate responses by model identity and cancel old/overdue worker tasks, without blocking browser interaction. (Kept in v2: the data model keeps the app's current layout engine, owner decision at M1 2026-10-22, so this behaviour stays; the prototype does not draw the state and it is verified by behaviour tests, not by pixels.)

**Completeness (DR-100):** the pending, failed and stale-model paths each have a deterministic test (controlled
engine, no wall-clock waits); the overdue bound surfaces the explicit error state, never an indefinite spinner; a
model switch mid-layout never paints the previous model. **NFRs:** interaction never blocked while the layout runs
(the worker/adapter runs off the main thread in browsers), no unbounded wait anywhere (resilience rule), no hard
waits in tests.

## Components

Touches `CMP-02-model-layout` (`useModelLayout.ts`, `elkEngine.ts`) and the viewer's pending/error rendering only.
Reuse the existing loading/error rendering as it is today (no copy change in W0; WO-02-018 moves copy to `t()`).
Installs: none.

## Visual reference

N/A (behaviour only: the frozen prototype does not draw the layout-pending state, FDD "Not specified" list; the state
keeps its current rendering until WO-02-018 restyles the viewer).

## Tests

- The regression test anchored in the confirmed cause (unit/component, under `src/components/modules/DataModelViewer/_tests/`).
- Repeated-run evidence before and after (recorded in the Status Note with commands and counts).
- `e2e/logical-data-model.spec.ts` stabilized if its flake shares the cause.

### Derogated tests (BL-0051)

- Implementer tests that may change: `src/components/modules/DataModelViewer/_tests/{navigation.test.tsx,viewport.test.tsx,DataModelViewer.test.tsx,layout.test.ts}`
  (waits only, never their assertions' intent), `e2e/logical-data-model.spec.ts` (waits only).
- Reviewer-authored, never edited here: `usability.reviewer.test.tsx`, `fullscreen.consistency.reviewer.test.tsx`,
  `async.ux.reviewer.test.tsx` and the rest of `DataModelViewer/_tests/*.reviewer*`; any needed change is handed to the
  FRD-02 gate reviewer with evidence.

## Dependencies

None (W0). WO-02-018 depends on it (same module, W3).

## Definition of done

The cause is confirmed with evidence (or ruled-out suspects and attribution guards are recorded); the minimal fix and
its regression test land; N consecutive runs of the viewer folder under load and of the e2e spec are green (N recorded
in the Status Note); `.pandacorp/verify.sh --since <ref>` green; the queue card is closed by the FRD-02 gate.

## Status Note

**Outcome: cause confirmed, test harness, not product.** The async layout lifecycle needed no change:
`useModelLayout.ts`, `elkEngine.ts` and the pending/error rendering are untouched, so AC-02-015.10 geometry and
the 20 s bound are unchanged. AC-02-015.11 was already met; `_tests/asyncLayout.test.tsx` now pins it deterministically.

**Reproduced on the unmodified tree (base 72daad88817f).** Only the full suite under extra contention reproduces it:
`vitest run` (503 files) alongside 40 CPU-bound processes on 10 cores, twice. Run b: 3 failed of 8062, in
`fullscreen.consistency.reviewer` (:80, wait at :73), `fullscreen.ux.reviewer` (:36, wait at :31) and
`navigation.test.tsx:33`, each `Unable to find role=...` with «Organizando modelo…» in the DOM. Run a: green, max 1043 ms.
Viewer folder alone: 5/5 green under 30 CPU-bound processes, which is why earlier runs with 4 processes saw nothing.

**Confirmed cause.** A file's FIRST layout runs against Testing Library's 1000 ms default `findBy*` budget and, loaded,
reaches that budget. Timing every real `layoutModel` call (throwaway instrumentation, not committed):
idle cold ELK 41 ms; green full suite 148-361 ms for the slowest first-in-file layouts; loaded run b, first-in-file up to
1025 ms while every later layout stayed at or below 172 ms. That predicts the symptom and the non-failures: only the
first wait of a file is exposed, the failing set varies by run (1-3 tests), and folder-only runs stay far below 1 s.
Injecting 1100 ms into `layoutModel` on the unmodified tree fails 29 of 58 tests with the same symptom, in all sighted files.

**Fix.** `_tests/waitForLayout.ts`: `waitForLayout(): Promise<void>` waits up to 21 s for the pending copy to leave,
then asserts it did not end in the layout error (the budget sits above the hook's 20 s bound, so a hung layout is
reported as `layout failed`, and a timeout as `layout still pending`). Used by `navigation.test.tsx` and
`DataModelViewer.test.tsx` (waits only, assertions unchanged). It reads `COPY.loading` / `COPY.layoutError`: when
WO-02-018 moves copy to `t()`, this helper moves with it.

**Evidence after the fix.** Viewer folder under 30 processes: 5/5 green (63 tests). 1100 ms injection: implementer files
0 failures, 20 failures all in `*.reviewer.*`. Full suite under 40 processes: 2 runs, 4 and 2 failures, all
in `*.reviewer.*`, none in implementer files. Mutation: `LAYOUT_WAIT_MS = 1_000` fails the regression test.
`e2e/logical-data-model.spec.ts`: 1 run, 6/6 in 19 s on port 4100 (warm; cold start not re-proven).

**REMAINING, needs the FRD-02 gate reviewer (DR-080, LESSON-0002): this flake is NOT closed until this is applied.** The
same 1 s default still governs these reviewer waits, which can still fail under load:
`usability.reviewer.test.tsx:11`, `viewer.reviewer.test.tsx:13`, `fullscreen.ux.reviewer.test.tsx:31`,
`fullscreen.consistency.reviewer.test.tsx:73`. Exact change: after `render(...)` in each helper, `await waitForLayout();`
from `./waitForLayout`, or pass `{}, { timeout: 21_000 }` as the query's arguments. Alternative at one seam:
`configure({ asyncUtilTimeout: 21_000 })` in `vitest.setup.ts`, outside this work order's files, and it would affect every suite.

**Suspects ruled out with evidence.** Lost resolution after cancellation or a stale response: every failure is pending on a
first layout that the timing log shows finishing, and `asyncLayout.test.tsx` covers stale and cancelled paths. Shared ELK
instance: `routeGraph` builds a new one per call. Fake timers: no viewer test used them before this work order; the new ones
restore real timers. Order dependence: not observed, and the failing tests are first-layout tests in each file.
ELK load itself: 19-23 ms. 20 s bound: the slowest measured layout is 1451 ms.

**Not verified.** The card's `navigation.test.tsx:37` sighting was not reproduced: line 37 is a synchronous query reached
only after the searchbox proved the layout ready, so this cause does not explain that exact line (the reproduction failed
at :33, the same test). The original log is unavailable. The e2e failure seen in the previous attempt
(`e2e/_hydration.ts:58`, `readyState` 15 s timeout on the first desktop case, 5 of 6 passing, diagram already in the
snapshot; LESSON-0185) is a separate document-readiness wait, not the layout. Its cause is unconfirmed; the two model-entry
`gotoHydrated` calls now allow 25 s, a spec-local wait with `_hydration.ts` unchanged. Concurrent writers: sibling lane 2
was running during these measurements, so contention was real but not exclusive to this work order. LESSON-0450 hermeticity
was not re-audited. No first-failure timeline is claimed beyond the card's dates; the timeline shows no viewer or vitest
config change between 2026-10-20 and the sightings other than `7b0d60c3` (setup hermeticity).

**Tests:** `_tests/asyncLayout.test.tsx` (5 cases citing AC-02-015.11), `_tests/navigation.test.tsx`,
`_tests/DataModelViewer.test.tsx`, `e2e/logical-data-model.spec.ts`. No shared component created; inventory unchanged.
