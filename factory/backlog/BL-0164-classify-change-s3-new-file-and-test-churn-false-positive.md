---
id: BL-0164
type: bug
area: plugin-skill
title: "classify-change.mjs S3 escalated to critical on ANY new file under src/, and counted test-file churn the same as production churn — both near-guaranteed a hand-back for a TDD-compliant change"
status: done
severity: p1
opened: 2026-09-23
closed: 2026-09-23
source: "canary 2 of /pandacorp:change --now on Mission Control, render UiPassSkipped (change-now-canary-2-report.md §4.1, 'S3 escala a critical CUALQUIER archivo nuevo bajo src/, sin mirar tamaño/contenido')"
closes: "plugin/scripts/classify-change.mjs classify() S1/S2/S3 size ladder"
links: [BL-0161, BL-0162, BL-0165]
---

## Problem
Two related false positives in the S1/S2/S3 size ladder, both discovered live in canary 2's real
`--now` reclassification (`31257a05..d819f340`, the `render-uipassskipped-timeline` change):

1. `newUnderSrc.length > 0` unconditionally escalated S3 to `critical` for ANY brand-new file under
   `src/`/`app/`/`components/`/`lib/`/`hooks/`, regardless of what the file was or how small it was.
   This project mandates TDD (acceptance tests before implementation, `docs/rules/quality-and-testing.md`),
   so almost any real behavior change adds at least one new file under `src/` (a `_tests/` case, a
   pure helper) — S3 turned that into a de-facto critical trigger for most genuine changes.
2. Even after (1), `churn > 150` (the OTHER S3 trigger) summed added+deleted lines across ALL files,
   test files included. DR-080 has the reviewer commit its own adversarial test suite alongside the
   implementer's acceptance tests, so a small, well-tested production change routinely carries 2-4x
   its own line count in test files. Canary 2's real diff: 33 production lines (`event-vm.ts`,
   `event-types.ts`, `events.ts`) + 247 test lines (3 test files) = 280 total, tripping `churn > 150`
   on test volume the project's own rules require.

Confirmed live: reclassifying canary 2's real range with the pre-fix classifier gave
`{"rigor":"critical","reasons":[{"signal":"S3","detail":"280 lines"}, ...]}` even after BL-0165 (S8)
was also fixed — the change never landed despite gate-green + reviewer-APPROVED (canary 2 report §1).

## Root cause
Both triggers conflated "this diff is large / touches new ground" with "this diff is risky" without
checking WHY a file is new or WHERE the lines landed. A new file's actual risk is already caught
elsewhere — S4 (new route file), S5 (new file on an auth/data-layer path: `_actions/`, `actions.*`,
`app/api/**`, `middleware.*`, `queries/`, `lib/data/**`), or any S5-S9 content signal, all of which
run over every file regardless of new-vs-modified. The blanket "new file" and "any line counts the
same" checks in S3 were therefore redundant with the real floor AND overly broad.

## Fix plan
1. Removed `newUnderSrc.length > 0` from S3's critical condition (`plugin/scripts/classify-change.mjs`
   classify(), S1/S2/S3 block). A plain new component/test/helper under `src/` now falls through to
   S2 (`normal`) via the existing `newFiles.length !== 0` branch — never `micro`, never blanket
   `critical`. S4/S5 continue to independently escalate a genuinely new floor-adjacent file.
2. Added `productionChurn` (`churn` with test-surface files — `isTestSurface`, the same predicate
   BL-0165/S8 uses: `*.test.ts`/`*.spec.ts`, `_tests?/`, `src/test/` — excluded) and switched S3's
   size trigger from `churn > 150` to `productionChurn > 150`. `files.length > 10` is untouched
   (still counts every file); every S5-S9 content/path floor signal still scans test files' added
   lines exactly as before — this narrows one size heuristic only, it exempts tests from nothing else.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-classify-change.sh`, marked `# ---- BL-0164/BL-0165 ----`:
- **BL-0164-neg**: a new `_tests/*.test.ts` + a new pure helper under `src/app/projects/[slug]/...`
  stay at `normal` (not `critical`), no `S3` signal.
- **BL-0164-pos** (control): a brand-new `src/app/api/**/route.ts` still escalates — via `S5`
  (path-based), independent of S3.
- **BL-0164-churn-neg**: 160 added lines on an EXISTING test file stay at `normal`, no `S3` signal.
- **BL-0164-churn-pos** (control): the same 160 lines added to an EXISTING production file still
  trips `S3` (`productionChurn > 150`).
Confirmed RED against the pre-fix script (all four new-file/churn cases classified `critical`);
GREEN after the fix. `bash plugin/scripts/test-classify-change.sh` — 127 passed / 0 failed / 0 xfail
(was 113 before BL-0164/BL-0165's combined 14 new cases).
Re-ran the REAL classifier against canary 2's preserved worktree (`panda-corp-change-uipts`,
`--range 31257a05..d819f340`, `--card render-uipassskipped-timeline.md`):
`{"rigor":"normal","reasons":[{"signal":"S2","detail":"280 lines, 6 file(s)"}],"floor_hits":[]}` —
no longer critical.
`bash plugin/scripts/run-engine-tests.sh` — all suites green.

## Done when
- [x] `test-classify-change.sh` BL-0164 cases are green, confirmed RED against the pre-fix script.
- [x] The real classifier gives `normal` (not `critical`) on canary 2's preserved worktree diff.
- [x] `bash plugin/scripts/run-engine-tests.sh` green.
- [x] `claude plugin validate plugin/` passes.
- [x] Fixed in commit `a36b50ce` on `main`.

## Out of scope
Re-running canary 2 end to end with the fix in place to confirm the change actually LANDS via
`--now` (a separate live canary, not part of this item's closeable scope) — the preserved worktree
and card were read-only inputs here, never touched.
