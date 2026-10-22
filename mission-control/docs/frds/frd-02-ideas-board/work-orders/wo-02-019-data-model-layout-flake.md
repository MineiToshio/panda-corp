---
id: WO-02-019
type: work-order
slug: data-model-layout-flake
title: WO-02-019 Data-model async layout, confirm and fix the «Organizando modelo…» flake
status: DRAFT
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
