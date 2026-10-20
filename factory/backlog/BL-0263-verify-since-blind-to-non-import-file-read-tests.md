---
id: BL-0263
type: change
area: templates
title: "verify.sh --since's vitest related-test selection is blind to a test that reads a changed file via fs, not import"
status: open
severity: p2
opened: 2026-10-19
closed:
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-19 (agent-inferred): a Codex-authored fidelity fix edited src/styles/*.css (a verbatim, byte-for-byte prototype port governed by ADR-0002); src/styles/_tests/styles.test.ts reads that CSS file from disk and compares it byte-for-byte rather than importing it, so verify.sh --since's import-graph-based related-test selection never ran it — the edit passed its own --since gate and the orchestrator's review, and only the full, unscoped Stop-gate verify.sh caught it. See LESSON-0437 for the generalized gotcha and LESSON-0442 for the incident this surfaced in."
closes:
links: [LESSON-0437, LESSON-0442, BL-0018]
---

## Problem

`verify.sh --since <sha>`'s vitest scoping relies on vitest's own changed-file/related-test heuristic,
which is import-graph based (which test files import which changed source files). A test that depends
on a changed file via `fs.readFileSync` (a byte-for-byte content comparison, a fixture copy, a snapshot
read) has no edge in that graph and is never selected, even though the file it depends on is literally
inside the diff the `--since` gate is supposed to be scoped to. This let an edit to an ADR-protected,
verbatim-ported file (`src/styles/*.css`) pass its own scoped gate clean.

## Root cause

`--since` scoping (shipped under BL-0018/DR-106 for the Playwright layer; vitest's own `--changed`
mechanism for the unit layer) was designed around the assumption that "related" means "imports/is
imported by" — true for ordinary module dependencies, false for a test that reads a sibling file
directly off disk rather than through the module system.

## Fix plan

1. In the stack-a template's `verify.sh` (and any other stack template with the same `--since` contract),
   after computing the normal vitest `--changed` selection, separately grep the changed file list against
   a small, explicit registry of "file read directly by a test, not imported" pairs (or, more generally,
   any test file matching a documented naming convention for byte-for-byte/fixture-read tests, e.g.
   `**/_tests/*.content.test.ts`) and force-include those test files whenever one of their tracked source
   files is in the diff.
2. Document the convention (how a project marks "this test reads a file directly, register it here") in
   `factory/standards/build-orchestration.md` §5 alongside the existing `--since` contract.

## Tests (prove the fix — TDD, RED → GREEN)

- A fixture project with a byte-for-byte comparison test registered against a tracked source file: editing
  that source file and running `verify.sh --since <sha>` runs the comparison test. RED today (not
  selected).
- The existing `--since` vitest `--changed` behavior for ordinary import-linked tests is unaffected.

## Done when

- Both tests above are green; `bash plugin/scripts/run-engine-tests.sh` stays green.
- `factory/standards/build-orchestration.md` updated; plugin + `OVERLAY_VERSION` bumped; LESSON-0437
  back-linked.

## Out of scope

A general static-analysis solution that auto-detects every non-import file dependency a test might have
— this item only requires an explicit, documented registration mechanism for the known pattern class.
